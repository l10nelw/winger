import { hasClass } from '../utils.js';
import * as Status from './status.js';
import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
export let $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);
document.addEventListener('click', onClick);


async function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedWindowIds } = response;
    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $list = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.replace('other', 'current');
            $row.querySelector('.tabActions').remove();
            $list = $currentWindow;
        }
        $list.appendChild($row);
    }
    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    lockHeight($otherWindows);
    Status.update(' ');
    await populateTabCounts();
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    const $input = $row.querySelector('input');
    const $editBtn = $row.querySelector('.editBtn');

    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;

    $row._id = $input._id = metaWindow.id;
    $input.$row = $editBtn.$row = $row;
    $row.$input = $input;
    $row.$editBtn = $editBtn;

    return $row;
}

async function populateTabCounts() {
    for (const $row of $allWindowRows) {
        const windowId = $row._id;
        const tabCount = (await browser.tabs.query({ windowId })).length;
        $row.querySelector('.tabCount').textContent = tabCount;
        Status.count.tabs += tabCount;
        Status.count.windows++;
    }
    Status.update();
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}

function onClick(event) {
    const $target = event.target;
    if ($target.id == 'help') {
        help();
    } else
    if ($target.id == 'options') {
        options();
    } else
    if (EditMode.handleClick($target)) {
        return; // Click handled by EditMode
    } else {
        const $row = $target.closest('.other');
        if ($row) {
            goalAction(event, $row._id, hasClass($target, 'bringTabBtn'), hasClass($target, 'sendTabBtn'));
        }
    }
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function options() {
    browser.runtime.openOptionsPage();
    window.close();
}

export function goalAction(event, windowId, doBringTabs, doSendTabs) {
    browser.runtime.sendMessage({ goalAction: [windowId, getModifiers(event), doBringTabs, doSendTabs] });
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
