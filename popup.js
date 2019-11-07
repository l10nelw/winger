import * as EditMode from './editmode.js';

const $currentWindowRow = document.getElementById('currentWindow');
const $commandInput = document.getElementById('commandInput');
const $windowList = document.getElementById('windowList');
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;

let metaWindows;

const port = browser.runtime.connect({ name: 'popup' });
port.onMessage.addListener(handleMessage);
$windowList.addEventListener('click', onClickRow);
$commandInput.addEventListener('keyup', onCommandInput);
EditMode.init(port, $commandInput);

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
        default: {
            EditMode.handleMessage(message);
        }
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
    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;
    $badge.textContent = metaWindow.tabCount;
    $row._id = $input._id = metaWindow.id;
    $row.$input = $input;
    $row.$badge = $badge;
}

function onClickRow(event) {
    if (EditMode.active) return;
    const $target = event.target;
    const $row = $target.closest('tr');
    if ($row) {
        respondWithBrowserOp(event, $row._id, !!$target.closest('.sendTabAction'));
    }
}

function onCommandInput(event) {
    const string = $commandInput.value;
    const $firstMatch = filterWindowNames(string);
    if (EditMode.active) return;
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
