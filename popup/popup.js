/*
- A window is represented in the popup as a 'row', which is represented by an HTML list item (<li>).
- All relevant data are embedded and managed within the popup's DOM structure. No separate, representative dataset
  to be maintained in parallel with the DOM (apart from Metadata in the background).
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Some DOM nodes have custom properties (expandos), prefixed with '_', to concisely store and pass around data.
*/

import { hasClass, getModifiers } from '../utils.js';
import init from './init.js';
import * as Key from './key.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

export const $body = document.body;
const $omnibox = Omnibox.$omnibox;
const supportBtns = { help, settings };

// Action attribute utilities
const actionAttr = 'data-action';
export const getActionAttr = $el => $el && $el.getAttribute(actionAttr);
export const unsetActionAttr = $el => $el && $el.removeAttribute(actionAttr);
export const getActionElements = ($scope = $body, suffix = '') => $scope.querySelectorAll(`[${actionAttr}]${suffix}`);

// Populated by init()
export let SETTINGS, $otherWindowsList, $currentWindowRow, $otherWindowRows, $allWindowRows;
let modifierHints;

(async () => {
    ({ SETTINGS, $otherWindowsList, $currentWindowRow, $otherWindowRows, $allWindowRows, modifierHints } = await init());
    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
    $body.addEventListener('focusout', onFocusOut);
})();

function onClick(event) {
    const $target = event.target;
    const id = $target.id;
    if (id in supportBtns) supportBtns[id](); // Closes popup
    if (EditMode.handleClick($target)) return;
    requestAction(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}

function onKeyDown(event) {
    let { key, target } = event;
    Key.enterCheck.down(key, target);
    if (EditMode.$active) return;
    if (Key.navigateByArrow(key, target)) return;
    if (key === 'Control') key = 'Ctrl';
    Omnibox.info(modifierHints[key]);
}

function onKeyUp(event) {
    const { key, target } = event;
    Key.enterCheck.up(key, target);
    if (EditMode.$active) return EditMode.handleKeyUp(key, target);
    Omnibox.info();
    if (target == $omnibox) return Omnibox.handleKeyUp(key, event);
    if (hasClass('otherRow', target) && ['Enter', ' '].includes(key)) return requestAction(event, target);
}

function onFocusOut(event) {
    if (event.target == $omnibox) Omnibox.info();
}

export function help() {
    browser.runtime.sendMessage({ help: true });
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
        originWindowId: $currentWindowRow._id,
        modifiers: getModifiers(event),
    });
    window.close();
}