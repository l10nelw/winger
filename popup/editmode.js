import {
    $body,
    $currentWindowRow,
    $omnibox,
    $names,
    nameMap,
    isField,
    isNameField,
    isInToolbar,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Request from './request.js';

import * as Name from '../name.js';
import indicateSuccess from '../success.js';
import { isWindowId } from '../utils.js';

/** @import { NameField$ } from './common.js' */
/** @import { WindowId, BNodeId } from '../types.js' */

/** Indicates if popup is in edit mode */
export let isActive = false;

export function toggle() {
    isActive ? done() : activate();
}

function activate() {
    nameMap.ready();
    toggleActive(true);
    if ($omnibox.value.startsWith('/'))
        Omnibox.clear();
    if ($currentWindowRow.$name === document.activeElement)
        rememberNameNow($currentWindowRow.$name);
}

function done() {
    toggleActive(false);
    clearErrors();
    $currentWindowRow.$name.tabIndex = 0;
    $omnibox.focus();
}

/**
 * @param {boolean} isActivate
 */
function toggleActive(isActivate) {
    isActive = isActivate;
    isActive ?
        $body.classList.replace('normal', 'edit') :
        $body.classList.replace('edit', 'normal');
    toggleNameFields(isActive);
}

/**
 * @param {HTMLElement} $el
 * @returns {boolean}
 */
export function handleMouseDown($el) {
    if (!isActive)
        return false;

    if (isNameField($el))
        return true;

    /** @type {NameField$} */
    const $name = $el.closest('li')?.$name;
    if ($name) {
        $name.focus();
        $name.select();
    }
    return true;
}

/**
 * @param {HTMLElement} $focused
 * @param {HTMLElement} $defocused
 * @returns {boolean}
 */
export function handleFocusIn($focused, $defocused) {
    if (!isActive)
        return false;

    // Allow focus only on fields and toolbar buttons
    if (!(isField($focused) || isInToolbar($focused))) {
        $defocused.focus();
        return true;
    }

    let isHandled = false;

    if (isNameField($defocused)) {
        trySaveNameAndHandleErrors($defocused);
        isHandled = true;
    }
    if (isNameField($focused)) {
        rememberNameNow($focused);
        isHandled = true;
    }
    return isHandled;
}

/**
 * @param {NameField$} $name
 * @returns {Promise<boolean>}
 */
export async function handleInput($name) {
    if (!isActive || !isNameField($name))
        return false;

    // Check name for validity, mark if invalid
    const errorId = nameMap.checkForErrors($name.value.trim(), $name._id);
    toggleError($name, errorId);

    return true;
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleKeyUp({ target, key }) {
    if (!isActive || !isNameField(target))
        return false;

    if (key === 'Enter') {
        trySaveNameAndHandleErrors(target);
        done();
    }
    return true;
}

/**
 * Remember `$name`'s value at this time (cases: when entering edit mode, and when `$name` is focused).
 * @param {NameField$} $name
 */
function rememberNameNow($name) {
    $name._original = $name.value;
}

/**
 * If name is invalid: restore original name and return false.
 * Otherwise: proceed to save and return true.
 * @param {NameField$} $name
 * @returns {Promise<boolean>}
 */
async function trySaveNameAndHandleErrors($name) {
    const originalName = $name._original;

    // Revert if marked invalid
    if ($name.classList.contains('error')) {
        $name.value = originalName;
        clearErrors();
        return false;
    }

    const name = $name.value.trim();
    $name.value = name;

    // Skip save if unchanged
    if (name === originalName)
        return true;

    if (await saveNameUpdateUI($name, name))
        return true;

    // Save failed
    $name.value = originalName;
    return false;
}

/**
 * @param {NameField$} $name
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function saveNameUpdateUI($name, name) {
    const id = $name._id;
    if (isWindowId(id)) {
        // id is windowId
        if (!await Name.save(id, name))
            return false;
        Request.updateChrome(id, name);
    } else {
        // id is folderId
        if (!await saveStashName(id, name))
            return false;
    }
    nameMap.ready().set(id, name);
    indicateSuccess($name.nextElementSibling);
    $body.classList.toggle('nameless', !nameMap.hasWindowName());
    return true;
}

/**
 * Indicate if name is invalid, as well as the duplicate name if any.
 * @param {NameField$} $name
 * @param {0 | -1 | WindowId | BNodeId} errorId
 */
function toggleError($name, errorId) {
    if (!errorId)
        return clearErrors();
    if (errorId !== -1)
        $names.find($name => $name._id === errorId).classList.add('error');
    $name.classList.add('error');
}

function clearErrors() {
    $names.forEach($name => $name.classList.remove('error'));
}

/**
 * @param {boolean} isEnable
 */
function toggleNameFields(isEnable) {
    const tabIndex = isEnable ? 0 : -1;
    const isReadOnly = !isEnable;
    for (const $name of $names) {
        $name.tabIndex = tabIndex;
        $name.readOnly = isReadOnly;
    }
}

/**
 * @param {BNodeId} folderId
 * @param {string} title
 * @returns {Promise<boolean>}
 */
const saveStashName = (folderId, title) => browser.bookmarks.update(folderId, { title }).then(() => true, () => false);
