import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const $windowList = document.getElementById('windowList');
export const $currentWindowRow = document.querySelector('#currentWindow tr');
export let $otherWindowRows, $allWindowRows;
export let metaWindows = {};

browser.runtime.sendMessage({ popup: true }).then(init);


function init(response) {
    metaWindows = response.metaWindows;
    const focusedWindowId = response.focusedWindowId;
    const sortedIds = response.sortedIds;
    for (const windowId of sortedIds) {
        const metaWindow = metaWindows[windowId];
        if (windowId == focusedWindowId) {
            populateRow($currentWindowRow, metaWindow);
        } else {
            addRow(metaWindow);
        }
    }
    $otherWindowRows = Array.from($windowList.rows);
    $allWindowRows = [$currentWindowRow].concat($otherWindowRows);
    $windowList.addEventListener('click', onClickRow);
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
}

function onClickRow(event) {
    if (EditMode.isActive) return;
    const $target = event.target;
    const $row = $target.closest('tr');
    if ($row) {
        goalAction(event, $row._id, !!$target.closest('.sendTabBtn'));
    }
}

export function goalAction(event, windowId, doSendTabs) {
    browser.runtime.sendMessage({
        module: 'BrowserOp',
        prop: 'goalAction',
        args: [windowId, getModifiers(event), doSendTabs],
    });
    window.close();
}

function getModifiers(event) {
    let modifiers = [];
    for (const prop in event) {
        if (prop.endsWith('Key') && event[prop]) {
            let modifier = prop[0].toUpperCase() + prop.slice(1, -3);
            modifiers.push(modifier);
        }
    }
    return modifiers;
}
