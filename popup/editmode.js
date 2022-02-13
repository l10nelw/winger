import {
    $body,
    $currentWindowRow,
    $omnibox,
    getActionElements,
    isField,
    isNameField,
} from './common.js';
import * as Tooltip from './tooltip.js';
import * as Status from './status.js';
import * as Request from './request.js';

const HINT = `Edit Mode: ENTER/↑/↓ to Save, ESC to Cancel`;

export let isActive = false; // Indicates if popup is in Edit Mode
let $allNames;
let $actions;
let $focusedName;

export function activate($name = $currentWindowRow.$name) {
    init();
    setActive(true);
    $name.focus();
    $focusedName = $name;
}

function init() {
    $allNames = $allNames || $body.querySelectorAll('.name');
    $actions = $actions || getActionElements();
}

function done() {
    setActive(false);
    $allNames.forEach($name => $name.classList.remove('nameError'));
    $currentWindowRow.$name.tabIndex = 0;
    $omnibox.focus();
}

function setActive(isActivate) {
    isActive = isActivate;
    $body.dataset.mode = isActivate ? 'edit' : 'normal';
    toggleDisabledActions(isActivate);
    toggleNameFields(isActivate);
    Status.show(isActivate ? HINT : null);
}

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

export async function handleInput($name) {
    if (!isActive || $name !== $focusedName) return false;
    const error = await Request.checkName($name.$row._id, $name.value.trim());
    toggleError($name, error);
    return true;
}

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
function toggleError($name, error) {
    $name.classList.toggle('nameError', error);
    toggleOtherFields($name, !error);
}

function toggleDisabledActions(isDisable) {
    $actions.forEach($action => $action.disabled = isDisable);
}

function toggleNameFields(isEnable) {
    toggleFields($allNames, isEnable);
}

function toggleOtherFields($field, isEnable) {
    const $fields = [...$allNames];
    $fields[$fields.indexOf($field)] = $omnibox;
    toggleFields($fields, isEnable);
}

function toggleFields($fields, isEnable) {
    const tabIndex = isEnable ? 0 : -1;
    const isReadOnly = !isEnable;
    for (const $field of $fields) {
        $field.tabIndex = tabIndex;
        $field.readOnly = isReadOnly;
    }
}