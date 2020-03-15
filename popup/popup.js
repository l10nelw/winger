/*
- A window is represented in the popup as a 'row', which is represented by a list item (<li>) in HTML.
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- All relevant data are embedded and managed within the popup's DOM structure. There is no separate, representative
  dataset to be maintained in parallel with the DOM (apart from Metadata in the background).
*/

import { hasClass, getModifiers } from '../utils.js';
import init from './init.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const $body = document.body;
const uniqueBtnActions = { help, settings };

// Action attribute utilities
const actionAttr = 'data-action';
export const getActionAttr = $el => $el && $el.getAttribute(actionAttr);
export const unsetActionAttr = $el => $el && $el.removeAttribute(actionAttr);
export const getActionElements = ($scope = $body, suffix = '') => $scope.querySelectorAll(`[${actionAttr}]${suffix}`);

// Populated by init()
export let SETTINGS, $currentWindowRow, $otherWindowRows, $allWindowRows;
let modifierHints;

(async () => {
    ({ SETTINGS, $currentWindowRow, $otherWindowRows, $allWindowRows, modifierHints } = await init());
    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
})();

function onClick(event) {
    const $target = event.target;
    const id = $target.id;
    if (id in uniqueBtnActions) uniqueBtnActions[id](); // Closes popup
    if (EditMode.handleClick($target)) return; // Handled by EditMode
    requestAction(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}

function onKeyDown(event) {
    if (!EditMode.$active) {
        let key = event.key;
        if (key === 'Control') key = 'Ctrl';
        Omnibox.info(modifierHints[key]);
    }
}

function onKeyUp(event) {
    const $target = event.target;
    if (!EditMode.$active) {
        Omnibox.info();
    }
    if ($target == Omnibox.$omnibox) {
        Omnibox.onKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        requestAction(event, $target);
    }
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function settings() {
    browser.runtime.openOptionsPage();
    window.close();
}

// Given a $row or any of its child elements, get the displayName.
export function getDisplayName($rowElement) {
    const $input = hasClass('input', $rowElement) && $rowElement || $rowElement.$input || $rowElement.$row.$input;
    return $input.value || $input.placeholder;
}

// Gather action parameters from event and $action element. If action and windowId found, send parameters to
// background to request action execution.
export function requestAction(event, $action = event.target) {
    const $row = $action.$row || $action;
    const windowId = $row._id;
    if (!windowId) return;
    const action = getActionAttr($action) || getActionAttr($row);
    if (!action) return;
    browser.runtime.sendMessage({
        action,
        windowId,
        reopen: hasClass('reopenTabs', $row),
        modifiers: getModifiers(event),
    });
    window.close();
}