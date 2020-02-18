/*
- All releavnt metadata is embedded and updated within the DOM structure = the popup's local source-of-truth throughout
  its lifetime. There is no separate set of data objects to be managed in parallel with the DOM.
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
*/

import { hasClass, addClass, changeClass, getModifiers } from '../utils.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Omnibar from './omnibar.js';
import * as EditMode from './editmode.js';

const $body = document.body;

// Mutated by removeElements(), used by createRow()
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const rowElementSelectors = new Set(['.send', '.bring', '.input', '.tabCount', '.edit']);

// Defined in init()
export let OPTIONS, $currentWindowRow, $otherWindowRows, $allWindowRows;

// data-action element attribute functions.
const actionAttr = 'data-action';
const getAction = $el => $el && $el.getAttribute(actionAttr);
const unsetAction = $el => $el && $el.removeAttribute(actionAttr);
export const getActionElements = ($scope, suffix = '') => $scope.querySelectorAll(`[${actionAttr}]${suffix}`);


browser.runtime.sendMessage({ popup: true }).then(init);

function init({ options, metaWindows, currentWindowId, sortedWindowIds, selectedTabCount }) {
    OPTIONS = options;
    removeElements(OPTIONS);

    const [$currentWindow, $otherWindows] = populateRows(metaWindows, currentWindowId, sortedWindowIds);
    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    Count.populate();
    indicateReopenAction();
    initTooltips(selectedTabCount);
    lockHeight($otherWindows);

    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keyup', onKeyUp);
}

function removeElements(OPTIONS) {
    const elements = {
        // Keys are from OPTIONS
        popup_bring:   [$rowTemplate, '.bring'],
        popup_send:    [$rowTemplate, '.send'],
        popup_edit:    [$rowTemplate, '.edit'],
        popup_help:    [$body, '#help'],
        popup_options: [$body, '#options'],
    }
    const $document = document.documentElement;
    const styles = getComputedStyle($document);
    const buttonWidth = styles.getPropertyValue('--width-btn-rem');
    let popupWidth = styles.getPropertyValue('--width-body-rem');

    for (const element in elements) {
        if (OPTIONS[element]) continue; // If element enabled, leave it alone
        const [$parent, selector] = elements[element];
        const $el = $parent.querySelector(selector);
        $el.remove();
        if ($parent == $rowTemplate) {
            rowElementSelectors.delete(selector);
            if ($el.tagName == 'BUTTON') popupWidth -= buttonWidth; // Reduce popup width if a row button is removed
        }
    }
    $document.style.setProperty('--width-body-rem', popupWidth);
}

function populateRows(metaWindows, currentWindowId, sortedWindowIds) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows  = document.getElementById('otherWindows');
    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        if (windowId == currentWindowId) {
            changeClass('otherRow', 'currentRow', $row);
            [$row, $row.$bring, $row.$send].forEach(unsetAction);
            $row.tabIndex = -1;
            $row.title = '';
            $currentWindow.appendChild($row);
        } else {
            $otherWindows.appendChild($row);
        }
    }
    return [$currentWindow, $otherWindows];
}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);

    // Add references to row elements, and in each, a reference to the row
    rowElementSelectors.forEach(selector => {
        const $el = $row.querySelector(selector);
        const property = selector.replace('.', '$');
        $el.$row = $row;
        $row[property] = $el;
    });

    // Add data
    $row._id = metaWindow.id;
    $row.$input.value = metaWindow.givenName;
    $row.$input.placeholder = metaWindow.defaultName;
    if (metaWindow.incognito) addClass('private', $row);

    return $row;
}

function indicateReopenAction() {
    const isPrivate = $row => hasClass('private', $row);
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentIsPrivate) addClass('reopenTabs', $row);
    }
}

function initTooltips(tabCount) {
    let rowNames = new Map();
    function memoisedRowName($row) {
        let name = rowNames.get($row);
        if (!name) {
            name = getDisplayName($row);
            rowNames.set($row, name);
        }
        return name;
    }
    const tabCountPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
    const reopenPhrase = '(close-reopen) ';
    const $actions = getActionElements($body);
    for (const $action of $actions) {
        const $row = $action.$row || $action;
        const name = memoisedRowName($row);
        const insertText = (hasClass('reopenTabs', $row) ? reopenPhrase : '') + tabCountPhrase;
        $action.title = updateTooltipName($action.title, name).replace('#', insertText);
    }
}

export function updateTooltipName(tooltip, name) {
    const colon = ': ';
    const colonIndex = tooltip.indexOf(colon);
    if (colonIndex > -1) {
        tooltip = tooltip.slice(0, colonIndex + colon.length) + name;
    }
    return tooltip;
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
        requestAction(event, $target);
    }
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) {
        event.preventDefault();
        return;
    }
}

function onKeyUp(event) {
    const $target = event.target;
    if ($target == Omnibar.$omnibar) {
        Omnibar.onKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        requestAction(event, $target);
    }
}

export function getDisplayName($rowElement) {
    const $input = hasClass('input', $rowElement) && $rowElement || $rowElement.$input || $rowElement.$row.$input;
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

// Get action parameters from event and $action element, to request for action execution by the background.
export function requestAction(event, $action = event.target) {
    const $row = $action.$row || $action;
    const windowId = $row._id;
    if (!windowId) return;
    const action = getAction($action) || getAction($row);
    if (!action) return;
    browser.runtime.sendMessage({
        action,
        windowId,
        reopen: hasClass('reopenTabs', $row),
        modifiers: getModifiers(event),
    });
    window.close();
}