import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
export let $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);
document.addEventListener('click', onClick);


function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedIds } = response;
    for (const windowId of sortedIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $table = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.replace('other', 'current');
            $row.querySelector('.sendTabBtn').remove();
            $table = $currentWindow;
        }
        $table.appendChild($row);
    }
    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    const $input = $row.querySelector('input');
    const $editBtn = $row.querySelector('.editBtn');
    const $tabCount = $row.querySelector('.tabCount');

    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;
    $tabCount.textContent = metaWindow.tabCount;

    $row._id = $input._id = metaWindow.id;
    $input.$row = $editBtn.$row = $row;
    $row.$input = $input;
    $row.$editBtn = $editBtn;

    return $row;
}

function onClick(event) {
    const $target = event.target;
    const $activeRow = EditMode.$active;
    if ($target.id == 'help') {
        help();
    } else if (hasClass($target, 'editBtn')) {
        const $row = $target.$row;
        $row == $activeRow ? EditMode.done() : EditMode.activate($row);
    } else if ($activeRow) {
        $activeRow.$input.focus();
    } else {
        const $row = $target.closest('.other');
        if ($row) goalAction(event, $row._id, hasClass($target, 'sendTabBtn'));
    }
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
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

function hasClass($el, cls) {
    return $el.classList.contains(cls);
}