import { hasClass } from '../utils.js';
import * as Status from './status.js';
import * as TabCount from './tabcount.js';
import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const $body = document.body;
let selectedTabCount = 1;
export let $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);

function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedWindowIds } = response;
    selectedTabCount = response.selectedTabCount;

    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $list = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.replace('otherRow', 'currentRow');
            $row.querySelector('.tabActions').remove();
            $row.tabIndex = -1;
            $list = $currentWindow;
        }
        $list.appendChild($row);
    }

    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    indicateReopenTab();
    lockHeight($otherWindows);
    TabCount.populate();

    $body.addEventListener('click', onClick);
    $body.addEventListener('mouseover', onMouseOver);
    $body.addEventListener('mouseleave', event => Status.show());
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);
    const $input = $row.querySelector('input');
    const $editBtn = $row.querySelector('.editBtn');
    const $tabCount = $row.querySelector('.tabCount');

    $input.value = metaWindow.givenName;
    $input.placeholder = metaWindow.defaultName;

    $row._id = $input._id = metaWindow.id;
    $input.$row = $editBtn.$row = $row;
    $row.$input = $input;
    $row.$editBtn = $editBtn;
    $row.$tabCount = $tabCount;
    if (metaWindow.incognito) $row.classList.add('private');

    return $row;
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}

function indicateReopenTab() {
    const isPrivate = $row => hasClass($row, 'private');
    const currentPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentPrivate) {
            const $tabActionBtns = $row.querySelectorAll('.tabActions button');
            $tabActionBtns.forEach($btn => $btn.classList.add('reopenTab'));
        }
    }
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
        const $row = $target.closest('.otherRow');
        if ($row) callGoalAction(event, $row._id, $target);
    }
}

function onMouseOver(event) {
    const $target = event.target;
    const $row = $target.closest('li');
    const name = $row ? $row.$input.value || $row.$input.placeholder : '';
    const tab_s = selectedTabCount == 1 ? 'tab' : 'tabs';
    const statusText =
        $target.matches('.reopenTab.bringTabBtn')   ? `Close ${tab_s} and reopen in (and switch to): ${name}` :
        $target.matches('.reopenTab.sendTabBtn')    ? `Close ${tab_s} and reopen in: ${name}` :
        $target.classList.contains('bringTabBtn')   ? `Bring ${tab_s} to: ${name}` :
        $target.classList.contains('sendTabBtn')    ? `Send ${tab_s} to: ${name}` :
        $target.classList.contains('editBtn')       ? `Edit: ${name}` :
        $row && $row.classList.contains('otherRow') ? `Switch to: ${name}` :
        '';
    Status.show(statusText);
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function options() {
    browser.runtime.openOptionsPage();
    window.close();
}

export function callGoalAction(event, windowId, $target) {
    let args = [windowId, getModifiers(event)];
    if ($target) args.push(hasClass($target, 'bringTabBtn'), hasClass($target, 'sendTabBtn'));
    browser.runtime.sendMessage({ goalAction: args });
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
