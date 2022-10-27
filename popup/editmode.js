import {
    $body,
    $currentWindowRow,
    $omnibox,
    isField,
    isNameField,
} from './common.js';
import * as Status from './status.js';
import * as Request from './request.js';

const HINT = `Edit Mode: ENTER/↑/↓ to Save, ESC to Cancel`;

export let isActive = false; // Indicates if popup is in Edit Mode
let $names, $actions, $focusedName;

//@ (Object), state -> state
export function activate($name = $currentWindowRow.$name) {
    $names ??= $body.querySelectorAll('.name');
    $actions ??= $body.querySelectorAll('[data-action]');
    setActive(true);
    $name.focus();
    $focusedName = $name;
}

//@ -> state
function done() {
    setActive(false);
    $names.forEach($name => $name.classList.remove('nameError'));
    $currentWindowRow.$name.tabIndex = 0;
    $omnibox.focus();
}

//@ (Boolean) -> state
function setActive(isActivate) {
    isActive = isActivate;
    $body.dataset.mode = isActivate ? 'edit' : 'normal';
    toggleDisabledActions(isActivate);
    toggleNameFields(isActivate);
    Status.show(isActivate ? HINT : null);
}

//@ (Object, Object) -> (Boolean), state|nil
export function handleFocusIn($focused, $defocused) {
    if (!isActive) return false;

    // Disallow defocusing field with error
    if ($defocused.classList.contains('nameError')) {
        $defocused.focus();
        return true;
    }
    // Disallow focus on non-fields
    if (!isField($focused)) {
        $defocused.focus();
        return true;
    }

    let isHandled = false;

    if (isNameField($defocused)) {
        trySaveName($defocused);
        isHandled = true;
    }
    if (isNameField($focused)) {
        $focusedName = $focused;
        $focusedName._original = $focusedName.value; // _original helps skip name save if unchanged
        isHandled = true;
    }
    return isHandled;
}

//@ (Object) -> (Boolean), state|nil
export async function handleInput($name) {
    if (!isActive || $name !== $focusedName) return false;
    const error = await Request.checkName($name.$row._id, $name.value.trim());
    toggleError($name, error);
    return true;
}

//@ (Object, String) -> (Boolean), state|nil
export function handleKeyUp($name, key) {
    if (!isActive || $name !== $focusedName) return false;

    if (key === 'Enter') {
        const success = trySaveName($name);
        if (success) done();
        return true;
    }

    return false;
}

// Trim content of name field and try to save it. Return true if successful, false otherwise.
//@ (Object) -> (Boolean), state|nil
function trySaveName($name) {
    const name = $name.value = $name.value.trim();

    if ($name.classList.contains('nameError')) return false;
    if (name === $name._original) return true;

    const windowId = $name.$row._id;
    Request.setName(windowId, name);
    return true;
}

// On name error, add indicator and disable other fields.
// Otherwise, remove indicator and enable other fields.
//@ (Object, Number) -> state
function toggleError($name, error) {
    $name.classList.toggle('nameError', error);
    toggleOtherFields($name, !error);
}

//@ (Boolean) -> state
function toggleDisabledActions(isDisable) {
    $actions.forEach($action => $action.disabled = isDisable);
}

//@ (Boolean) -> state
function toggleNameFields(isEnable) {
    toggleFields($names, isEnable);
}

//@ (Object, Boolean) -> state
function toggleOtherFields($field, isEnable) {
    const $fields = [...$names];
    $fields[$fields.indexOf($field)] = $omnibox;
    toggleFields($fields, isEnable);
}

//@ ([Object], Boolean) -> state
function toggleFields($fields, isEnable) {
    const tabIndex = isEnable ? 0 : -1;
    const isReadOnly = !isEnable;
    for (const $field of $fields) {
        $field.tabIndex = tabIndex;
        $field.readOnly = isReadOnly;
    }
}