/*
- A window is represented in the popup as a 'row', which is represented by an HTML list item (<li>).
- All relevant data are embedded and managed within the popup's DOM structure. No separate, representative dataset
  to be maintained in parallel with the DOM (apart from Metadata in the background).
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Some DOM nodes have custom properties (expandos), prefixed with '_', to concisely store and pass around data.
*/

import { hasClass, getModifiers, isInput } from '../utils.js';
import init from './init.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const $body = document.body;
const supportBtns = { help, settings };
let $enterKeyDownInput = null;

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
    if (id in supportBtns) supportBtns[id](); // Closes popup
    if (EditMode.handleClick($target)) return; // Handled by EditMode
    requestAction(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}

function onKeyDown(event) {
    let key = event.key;
    const $target = event.target;
    if (!EditMode.$active) {
        if (key === 'Control') key = 'Ctrl';
        Omnibox.info(modifierHints[key]);
    }
    if (key === 'Enter' && isInput($target)) {
        $enterKeyDownInput = $target;
    }
}

function onKeyUp(event) {
    const key = event.key;
    const $target = event.target;
    if (!EditMode.$active) Omnibox.info();
    if (key === 'Enter' && $target === $enterKeyDownInput) {
        // Indicate that Enter has been keyed down and up both within the same input.
        // Guards against cases where input receives the keyup after the keydown was invoked elsewhere (usually a button).
        $target._enter = true;
        $enterKeyDownInput = null;
    }
    if ($target == Omnibox.$omnibox) {
        Omnibox.handleKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(key)) {
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