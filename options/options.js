import { hasClass } from '../utils.js';
import * as Settings from '../background/settings.js';

const $form = document.body.querySelector('form');
const $fields = [...$form.querySelectorAll('.setting')];
const $submitBtns = [...$form.querySelectorAll('button')];
const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
const getFormValuesString = () => $fields.map($field => $field[relevantProp($field)]).join();
let SETTINGS, formData;
let toggleGroups = {};

(async () => {
    SETTINGS = await Settings.retrieve();
    for (const $field of $fields) {
        loadSetting($field);
        enableFields($field);
        addToggleGroup($field);
    }
    for (const name in toggleGroups) toggleToggler({ name });
    formData = getFormValuesString();
})();

$form.onchange = onFieldChange;
$form.onsubmit = applySettings;

function onFieldChange({ target: $field }) {
    enableFields($field);
    toggleFields($field);
    toggleToggler({ $field });
    saveSetting($field);
    enableSubmitBtns();
}

function applySettings() {
    browser.runtime.reload();
}

function loadSetting($field) {
    $field[relevantProp($field)] = SETTINGS[$field.name];
}

function saveSetting($field) {
    if (hasClass('setting', $field))
        browser.storage.local.set({ [$field.name]: $field[relevantProp($field)] });
}

// For a $field with the data-enabler attribute: enable/disable fields that are enabled by it.
function enableFields($field) {
    if (!('enabler' in $field.dataset)) return;
    const disable = !$field.checked;
    const $targets = $form.querySelectorAll(`[data-enabled-by="${$field.name}"]`);
    for (const $target of $targets) {
        $target.disabled = disable;
    }
}

// For a $field with the data-toggled-by attribute: group it with others that share the same toggler.
function addToggleGroup($field) {
    if (!('toggledBy' in $field.dataset)) return;
    const toggler = $field.dataset.toggledBy;
    if (toggler in toggleGroups) {
        toggleGroups[toggler].push($field);
    } else {
        toggleGroups[toggler] = [$field];
    }
}

// For a $field with the data-toggler attribute: check/uncheck fields that are toggled by it.
function toggleFields($toggler) {
    if (!('toggler' in $toggler.dataset)) return;
    const check = $toggler.checked;
    for (const $target of toggleGroups[$toggler.name]) {
        $target.checked = check;
        saveSetting($target);
    }
}

// Given a $field with the data-toggled-by attribute, or given a toggler name:
// set the state of the toggler based on the states of the associated group of fields.
function toggleToggler({ $field, name }) {
    if ($field) {
        if (!('toggledBy' in $field.dataset)) return;
        name = $field.dataset.toggledBy;
    }
    const $toggler = $form[name];
    const $targets = toggleGroups[name];
    const $checked = $targets.filter($target => $target.checked);
    $toggler.indeterminate = false;
    if ($checked.length === 0) {
        $toggler.checked = false;
    } else
    if ($checked.length === $targets.length) {
        $toggler.checked = true;
    } else {
        $toggler.indeterminate = true;
    }
}

function enableSubmitBtns() {
    const isFormUnchanged = formData === getFormValuesString();
    $submitBtns.forEach($btn => $btn.disabled = isFormUnchanged);
}