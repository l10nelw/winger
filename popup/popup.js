/*
- A window is represented in the popup as a 'row', which is represented by an HTML list item (<li>).
- All relevant data are embedded and managed within the popup's DOM structure. No separate, representative dataset to
  be maintained in parallel with the DOM (apart from Metadata in the background).
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Some DOM nodes have custom properties (expandos) prefixed with '_' or '$', to store and pass around data.
*/

import { isInput, hasClass, getModifiers } from '../utils.js';
import init from './init.js';
import navigateByArrow from './navigation.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';

export const $body = document.body;
export const $otherWindowsList = document.getElementById('otherWindows');
export const $toolbar = $body.querySelector('footer');
const $omnibox = Omnibox.$omnibox;

export const isRow = $el => $el?._id;

// Action attribute utilities
const actionAttr = 'data-action';
export const getActionAttr = $el => $el?.getAttribute(actionAttr);
export const unsetActionAttr = $el => $el?.removeAttribute(actionAttr);
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
    $body.addEventListener('focusout', onFocusOut);
    $currentWindowRow.$input.addEventListener('dblclick', onDoubleClick);
})();

function onClick(event) {
    const { target: $target } = event;
    const id = $target.id;
    if (id in Toolbar) return Toolbar[id]();
    if (EditMode.handleClick($target)) return;
    requestAction(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}


function onKeyDown(event) {
    const { key, target: $target } = event;
    inputEnterCheck.down(key, $target);
    if (EditMode.$active) return;
    if (navigateByArrow(key, $target)) return;
    if (showModifierHint(key)) return;
    if (['Tab', 'Enter', ' '].includes(key)) return;
    if ($target !== $omnibox) $omnibox.focus();
}

function onKeyUp(event) {
    const { key, target: $target } = event;
    inputEnterCheck.up(key, $target);
    if (EditMode.$active) return EditMode.handleKeyUp(key, $target);
    if (isRow($target) && (key === 'Enter' || key === ' ')) return requestAction(event, $target);
    if ($target === $omnibox) {
        Omnibox.info();
        Omnibox.handleKeyUp(key, event);
    }
}

function onFocusOut(event) {
    if (event.target == $omnibox) Omnibox.info();
}

function onDoubleClick() {
    if (!EditMode.$active) EditMode.activate();
}

// Flag if Enter has been keyed down and up both within the same input. A handler should then check and reset the flag (_enter).
// Guards against cases where input receives the keyup after the keydown was invoked elsewhere (usually a button).
const inputEnterCheck = {
    $input: null,
    down(key, $target) {
        if (key === 'Enter' && isInput($target)) {
            this.$input = $target;
        }
    },
    up(key, $target) {
        if (key === 'Enter' && $target === this.$input) {
            $target._enter = true;
            this.$input = null;
        }
    }
};

function showModifierHint(key) {
    if (key === 'Control') key = 'Ctrl';
    const hint = modifierHints[key];
    Omnibox.info(hint);
    return hint;
}

// Given a $row or any of its child elements, get the givenName or defaultName.
export function getName($rowElement) {
    const $input = hasClass('input', $rowElement) && $rowElement || $rowElement.$input || $rowElement.$row.$input;
    return $input.value || $input.placeholder;
}

// Gather action parameters from event and $action element. If action and windowId found, send parameters to
// background to request action execution.
export async function requestAction(event, $action = event.target) {
    const $row = $action.$row || $action;
    const windowId = $row._id;
    if (!windowId) return;
    const action = getActionAttr($action) || getActionAttr($row);
    if (!action) return;
    await browser.runtime.sendMessage({
        action,
        windowId,
        originWindowId: $currentWindowRow._id,
        modifiers: getModifiers(event),
    });
    window.close();
}
