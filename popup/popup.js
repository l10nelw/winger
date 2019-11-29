import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const $currentWindow = document.getElementById('currentWindow');
const $otherWindows = document.getElementById('otherWindows');
export let $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);
$otherWindows.addEventListener('click', onClickRow);


function init(response) {
    const { metaWindows, focusedWindowId, sortedIds } = response;
    for (const windowId of sortedIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $table = $otherWindows;
        if (windowId == focusedWindowId) {
            $row.querySelector('.sendTabBtn').remove();
            $table = $currentWindow;
        }
        $table.appendChild($row);
    }
    $currentWindowRow = $currentWindow.rows[0];
    $otherWindowRows = [...$otherWindows.rows];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    const $input = $row.querySelector('input');
    const $editBtn = $row.querySelector('.editBtn');
    const $badge = $row.querySelector('.badge');

    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;
    $badge.textContent = metaWindow.tabCount;

    // Add references to id and related elements
    $row._id = $input._id = metaWindow.id;
    $input.$row = $editBtn.$row = $row;
    $row.$input = $input;
    $row.$editBtn = $editBtn;

    return $row;
}

function onClickRow(event) {
    if (EditMode.$active) return;
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
