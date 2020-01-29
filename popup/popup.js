import { hasClass, getModifiers } from '../utils.js';
import * as Count from './count.js';
import * as Status from './status.js';
import * as Omnibar from './omnibar.js';
import * as Tooltip from './tooltip.js';
import * as EditMode from './editmode.js';

const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const $body = document.body;
export let OPTIONS, $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);

function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedWindowIds } = response;
    OPTIONS = response.OPTIONS;

    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $list = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.remove('action');
            $row.classList.replace('otherRow', 'currentRow');
            $row.$bringBtn.remove();
            $row.$sendBtn.remove();
            $row.tabIndex = -1;
            $list = $currentWindow;
        }
        $list.appendChild($row);
    }

    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    const hasReopenTab = indicateReopenTab();
    Tooltip.generate(response.selectedTabCount, hasReopenTab);
    Count.populate();
    lockHeight($otherWindows);

    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('focusin', Tooltip.show);
    $body.addEventListener('mouseover', Tooltip.show);
    $body.addEventListener('mouseleave', event => Status.show());
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);

    // Add references to elements, and in each a reference to the row
    const elements = ['sendBtn', 'bringBtn', 'input', 'tabCount', 'editBtn'];
    for (const element of elements) {
        const prop = `$${element}`;
        $row[prop] = $row.querySelector(`.${element}`);
        $row[prop].$row = $row;
    }

    // Add data
    $row._id = metaWindow.id;
    $row.$input.value = metaWindow.givenName;
    $row.$input.placeholder = metaWindow.defaultName;
    if (metaWindow.incognito) $row.classList.add('private');

    return $row;
}

function indicateReopenTab() {
    const isPrivate = $row => hasClass('private', $row);
    const currentPrivate = isPrivate($currentWindowRow);
    let hasReopenTab = false;
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentPrivate) {
            $row.classList.add('reopenTab');
            hasReopenTab = true;
        }
    }
    return hasReopenTab;
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
        const $row = $target.closest('.otherRow');
        if ($row) callGoalAction(event, $row._id, $target);
    }
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) {
        event.preventDefault();
        return;
    }
}

function onKeyDown(event) {
    const modifiers = getModifiers(event);
    if (modifiers.length) Tooltip.show(modifiers);
}

function onKeyUp(event) {
    Tooltip.show([]);
    const $target = event.target;
    if ($target == Omnibar.$omnibar) {
        Omnibar.onKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        callGoalAction(event, $target._id, null, modifiers);
    }
}

export function rowName($row) {
    const $input = $row.$input;
    return $input.value || $input.placeholder;
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function options() {
    browser.runtime.openOptionsPage();
    window.close();
}

export function callGoalAction(event, windowId, $target, modifiers) {
    let args = [windowId, modifiers || getModifiers(event)];
    if ($target) args.push(hasClass('bringBtn', $target), hasClass('sendBtn', $target));
    browser.runtime.sendMessage({ goalAction: args });
    window.close();
}