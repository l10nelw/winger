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
let $names, $actions;

//@ (Object), state -> state
export function activate($name = $currentWindowRow.$name) {
    $names = [...$body.querySelectorAll('.name')];
    $actions ??= $body.querySelectorAll('[data-action]');
    setActive(true);
    $name.focus();
    $name._original = $name.value; // Remember name at focus time
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
    if (!isActive)
        return false;

    // Disallow focus on non-fields
    if (!isField($focused)) {
        $defocused.focus();
        return true;
    }

    let isHandled = false;

    if (isNameField($defocused)) {
        if ($defocused.classList.contains('nameError')) {
            $defocused.value = $defocused._original;
            clearErrors();
        } else {
            trySaveName($defocused);
        }
        isHandled = true;
    }
    if (isNameField($focused)) {
        $focused._original = $focused.value; // Remember name at focus time
        isHandled = true;
    }
    return isHandled;
}

//@ (Object) -> (Boolean), state|nil
export async function handleInput($name) {
    if (!isActive || $name !== document.activeElement)
        return false;

    // Check name for validity, mark if invalid
    const error = await Request.checkName($name.$row._id, $name.value.trim());
    toggleError($name, error);

    return true;
}

//@ (Object, String) -> (Boolean), state|nil
export function handleKeyUp($name, key) {
    if (!isActive || $name !== document.activeElement)
        return false;

    if (key === 'Enter' && trySaveName($name))
        done();

    return true;
}

// Trim content of name field and try to save it. Return true if successful, false otherwise.
//@ (Object) -> (Boolean), state|nil
function trySaveName($name) {
    // Prevent save if marked invalid
    if ($name.classList.contains('nameError'))
        return false;

    const name =
        $name.value = $name.value.trim();

    // Skip save if unchanged
    if (name === $name._original)
        return true;

    // Save
    const windowId = $name.$row._id;
    Request.setName(windowId, name);
    return true;
}

// On name error, add error indicator.
//@ (Object, Number) -> state
function toggleError($name, error) {
    $name.classList.toggle('nameError', error);
}

//@ (Boolean) -> state
function toggleDisabledActions(isDisable) {
    $actions.forEach($action => $action.disabled = isDisable);
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