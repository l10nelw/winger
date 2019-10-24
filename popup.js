'use strict';

const $currentWindowRow = document.getElementById('currentWindow');
const $searchInput = document.getElementById('searchInput');
const $windowList = document.getElementById('windowList');
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
let metaWindowsMap = {};

const port = browser.runtime.connect({ name: 'popup' });
port.onMessage.addListener(message => {
    metaWindowsMap = message.metaWindowsMap;
    const focusedWindowId = message.focusedWindowId;
    const sortedIds = message.sortedIds;
    for (const windowId of sortedIds) {
        const metaWindow = metaWindowsMap[windowId];
        windowId == focusedWindowId ? populateRow($currentWindowRow, metaWindow) : addRow(metaWindow);
    }
});
$windowList.addEventListener('click', onClickRow);
$searchInput.addEventListener('keyup', onSearchInput);


function addRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    populateRow($row, metaWindow);
    $windowList.appendChild($row);
}

function populateRow($row, metaWindow) {
    const name = metaWindow.givenName || metaWindow.defaultName;
    $row._id = metaWindow.id;
    $row._name = name;
    $row._isNamed = !!metaWindow.givenName;
    $row.querySelector('input').value = name;
    $row.querySelector('.badge').textContent = metaWindow.tabCount;
}

function onClickRow(event) {
    const $target = event.target;
    const $row = $target.closest('tr');
    if ($row) {
        respondWithBrowserOp(event, $row._id, $target.closest('.actionSendTabs'));
    }
}

function onSearchInput(event) {
    const string = $searchInput.value;
    const $firstMatch = searchWindowNames(string);
    if (event.key == 'Enter' && $firstMatch) {
        respondWithBrowserOp(event, $firstMatch._id);
    }
}

// Hides rows whose names do not contain string. Returns first matching row or null
function searchWindowNames(string) {
    const $rows = $windowList.rows;
    let $firstMatch;
    if (string) {
        for (const $row of $rows) {
            const isMatch = $row._name.includes(string);
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
    let modifiers = [];
    if (event.altKey) modifiers.push('Alt');
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.shiftKey) modifiers.push('Shift');
    port.postMessage({
        browserOp: 'respond',
        args: [windowId, modifiers, !!sendTabsByDefault],
    });
    window.close();
}