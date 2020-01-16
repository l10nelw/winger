import { retrieveOptions } from '../background/options.js';

const $form = document.querySelector('form');
const $modifierFields = ['bringtab_modifier', 'sendtab_modifier'].map(fieldName => $form[fieldName]);
let OPTIONS;
init();

async function init() {
    OPTIONS = await retrieveOptions();
    for (const fieldName in OPTIONS) {
        setFieldValue(fieldName, OPTIONS[fieldName]);
    }
    document.body.hidden = false; // Page initially hidden to avoid flash of value changes on reload.
    $form.onchange = onOptionChange;
}

function onOptionChange(event) {
    const $target = event.target;
    handleModifierFields($target);
    storeOption($target);
    browser.runtime.reload();
}

// If a modifier option is set to the same as the other, swap their values instead.
function handleModifierFields($target) {
    const index = $modifierFields.indexOf($target);
    if (index == -1) return;
    const $other = $modifierFields[1 - index];
    if ($target.value == $other.value) {
        $other.value = OPTIONS[$target.name];
        storeOption($other);
    }
}

function storeOption($target) {
    const fieldName = $target.name;
    let option = {};
    option[fieldName] = getFieldValue(fieldName);
    browser.storage.local.set(option);
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