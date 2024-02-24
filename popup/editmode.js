import * as Name from '../name.js';
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
import indicateSuccess from '../success.js';

export let isActive = false; // Indicates if popup is in edit mode

//@ state -> state
export function toggle() {
    isActive ? done() : activate();
}

//@ state -> state
function activate() {
    nameMap.ready();
    toggleActive(true);
    if ($omnibox.value.startsWith('/'))
        Omnibox.clear();
    if ($currentWindowRow.$name === document.activeElement)
        rememberNameNow($currentWindowRow.$name);
}

//@ -> state
function done() {
    toggleActive(false);
    clearErrors();
    $currentWindowRow.$name.tabIndex = 0;
    $omnibox.focus();
}

//@ (Boolean) -> state
function toggleActive(isActivate) {
    isActive = isActivate;
    $body.dataset.mode = isActivate ? 'edit' : 'normal';
    toggleNameFields(isActivate);
}

//@ (Object) -> (Boolean), state|nil
export function handleMouseDown($el) {
    if (!isActive)
        return false;

    if (isNameField($el))
        return true;

    const $name = $el.closest('li')?.$name;
    if ($name) {
        $name.focus();
        $name.select();
    }
    return true;
}

//@ (Object, Object) -> (Boolean), state|nil
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
        trySaveName($defocused);
        isHandled = true;
    }
    if (isNameField($focused)) {
        rememberNameNow($focused);
        isHandled = true;
    }
    return isHandled;
}

//@ (Object) -> (Boolean), state|nil
export async function handleInput($name) {
    if (!isActive || !isNameField($name))
        return false;

    // Check name for validity, mark if invalid
    const error = nameMap.checkForErrors($name.value.trim(), $name._id);
    toggleError($name, error);

    return true;
}

//@ (Object, String) -> (Boolean), state|nil
export function handleKeyUp({ target, key }) {
    if (!isActive || !isNameField(target))
        return false;

    if (key === 'Enter') {
        trySaveName(target);
        done();
    }
    return true;
}

// Remember $name's value at this time (cases: when entering edit mode, and when $name is focused).
//@ (Object) -> state
function rememberNameNow($name) {
    $name._original = $name.value;
}

// If name is invalid: restore original name and return false.
// Otherwise: proceed to save, indicate success and return true.
//@ (Object) -> (Boolean), state|nil
async function trySaveName($name) {
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

    // Save
    const windowId = $name._id;
    if (await Name.save(windowId, name)) {
        Request.updateChrome(windowId, name);
        nameMap.set(windowId, name);
        indicateSuccess($name.$row);
        $body.classList.toggle('nameless', !nameMap.hasName());
        return true;
    }

    // Save failed
    $name.value = originalName;
    return false;
}

// Indicate if name is invalid, as well as the duplicate name if any.
//@ (Object, Number) -> state
function toggleError($name, error) {
    if (!error)
        return clearErrors();
    if (error > 0)
        $names.find($name => $name._id === error).classList.add('error');
    $name.classList.add('error');
}

///@ -> state|nil
function clearErrors() {
    $names.forEach($name => $name.classList.remove('error'));
}

//@ (Boolean) -> state
function toggleNameFields(isEnable) {
    const tabIndex = isEnable ? 0 : -1;
    const isReadOnly = !isEnable;
    for (const $name of $names) {
        $name.tabIndex = tabIndex;
        $name.readOnly = isReadOnly;
    }
}
