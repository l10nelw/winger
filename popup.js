'use strict';

const $currentWindowRow = document.getElementById('currentWindow');
const $searchInput = document.getElementById('searchInput');
const $windowList = document.getElementById('windowList');
const $editModeToggle = document.getElementById('editMode');
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;

let metaWindows;
let $inputs = [];

const port = browser.runtime.connect({ name: 'popup' });
port.onMessage.addListener(handleMessage);
$windowList.addEventListener('click', onClickRow);
$searchInput.addEventListener('keyup', onSearchInput);

function handleMessage(message) {
    switch (message.response) {
        case 'popup open': {
            metaWindows = message.metaWindows;
            const focusedWindowId = message.focusedWindowId;
            const sortedIds = message.sortedIds;
            for (const windowId of sortedIds) {
                const metaWindow = metaWindows[windowId];
                windowId == focusedWindowId ? populateRow($currentWindowRow, metaWindow) : addRow(metaWindow);
            }
        }
        break;
        case 'editMode setName': {
            const status = message.result;
            if (status > 0) {
                const $input = $inputs.find($input => $input._id == status);
                EditMode.showError($input)
            }
        }
        break;
    }
}

function addRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    populateRow($row, metaWindow);
    $windowList.appendChild($row);
}

function populateRow($row, metaWindow) {
    const $input = $row.querySelector('input');
    const $badge = $row.querySelector('.badge');
    $input.value = metaWindow.displayName;
    $badge.textContent = metaWindow.tabCount;
    $row._id = $input._id = metaWindow.id;
    $row.$input = $input;
    $row.$badge = $badge;
    $inputs.push($input);
}

function onClickRow(event) {
    if ($editModeToggle.checked) return;
    const $target = event.target;
    const $row = $target.closest('tr');
    if ($row) {
        respondWithBrowserOp(event, $row._id, !!$target.closest('.actionSendTabs'));
    }
}

function onSearchInput(event) {
    const string = $searchInput.value;
    const $firstMatch = filterWindowNames(string);
    if ($editModeToggle.checked) return;
    if (event.key == 'Enter' && $firstMatch) {
        respondWithBrowserOp(event, $firstMatch._id);
    }
}

// Hide rows whose names do not contain string. Returns first matching row or null.
function filterWindowNames(string) {
    const $rows = $windowList.rows;
    let $firstMatch;
    if (string) {
        for (const $row of $rows) {
            const isMatch = $row.$input.value.includes(string);
            $row.hidden = !isMatch;
            $firstMatch = $firstMatch || (isMatch ? $row : null); // if not already found, it's this row
        }
    } else {
        for (const $row of $rows) {
            $row.hidden = false;
        }
        $firstMatch = $rows[0];
    }
    return $firstMatch;
}

function respondWithBrowserOp(event, windowId, sendTabsByDefault) {
    port.postMessage({
        command: true,
        module: 'BrowserOp',
        prop: 'respond',
        args: [windowId, eventModifiers(event), sendTabsByDefault],
    });
    window.close();
}

function eventModifiers(event) {
    let modifiers = [];
    for (const prop in event) {
        if (prop.endsWith('Key') && event[prop]) {
            let modifier = prop[0].toUpperCase() + prop.slice(1, -3);
            modifiers.push(modifier);
        }
    }
    return modifiers;
}


var EditMode = {

    toggle() {
        const editMode = $editModeToggle.checked;
        for (const $input of $inputs) {
            $input.readOnly = !editMode;
        }
        if (editMode) {
            document.body.addEventListener('change', EditMode.onInputChange);
        }
        // document.body[editMode ? 'addEventListener' : 'removeEventListener']('change', this.onInputChange);
    },

    onInputChange(event) {
        const $target = event.target;
        if ($target.type != 'text') return;
        const name = $target.value;
        $target.value = name.trim();

        EditMode.resetErrors();
        const $duplicate = EditMode.duplicatedName(name, $target);
        if ($duplicate) {
            EditMode.showError($target);
            EditMode.showError($duplicate);
        } else {
            port.postMessage({
                request: 'editMode setName',
                module: 'Metadata',
                prop: 'setName',
                args: [$target._id, name],
            });
        }

    },

    duplicatedName(name, $exclude) {
        const $input = $inputs.find($input => $input !== $exclude && $input.value == name);
        return $input || 0;
    },

    showError($input) {
        $input.classList.add('inputError');
    },

    resetErrors() {
        for (const $input of $inputs) {
            $input.classList.remove('inputError');
        }
    },


}
$editModeToggle.addEventListener('change', EditMode.toggle);
