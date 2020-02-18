import * as Settings from '../background/settings.js';

const $body = document.body;
const $form = $body.querySelector('form');
const $modifierFields = [$form.bring_modifier, $form.send_modifier];
let SETTINGS;
init();

async function init() {
    SETTINGS = await Settings.retrieve();
    for (const fieldName in SETTINGS) {
        setFieldValue(fieldName, SETTINGS[fieldName]);
    }
    $body.hidden = false; // Page initially hidden to avoid flash of value changes on reload.
    $form.onchange = onFieldChange;
}

function onFieldChange(event) {
    const $target = event.target;
    handleModifierFields($target);
    saveSetting($target);
    browser.runtime.reload();
}

// If a modifier option is set to the same as the other, swap their values instead.
function handleModifierFields($target) {
    const index = $modifierFields.indexOf($target);
    if (index == -1) return;
    const $other = $modifierFields[1 - index];
    if ($target.value == $other.value) {
        $other.value = SETTINGS[$target.name];
        saveSetting($other);
    }
}

function saveSetting($target) {
    const fieldName = $target.name;
    browser.storage.local.set({ [fieldName]: getFieldValue(fieldName) });
}

function setFieldValue(fieldName, value) {
    const $field = $form[fieldName];
    if ($field) $field[relevantFieldProp($field)] = value;
}

function getFieldValue(fieldName) {
    const $field = $form[fieldName];
    return $field[relevantFieldProp($field)];
}

function relevantFieldProp($field) {
    return $field.type == 'checkbox' ? 'checked' : 'value';
}