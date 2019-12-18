import { retrieveOptions } from '../background/options.js';

const $form = document.querySelector('form');
const $modifierFields = ['bring_tab_modifier', 'send_tab_modifier'].map(name => $form[name]);
let OPTIONS;
init();

async function init() {
    OPTIONS = await retrieveOptions();
    for (const name in OPTIONS) {
        setFieldValue(name, OPTIONS[name]);
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
    const name = $target.name;
    let option = {};
    option[name] = getFieldValue(name);
    browser.storage.local.set(option);
}

function setFieldValue(name, value) {
    const $field = $form[name];
    if ($field.type == 'checkbox') {
        $field.checked = value;
    } else {
        $field.value = value;
    }
}

function getFieldValue(name) {
    const $field = $form[name];
    return $field.type == 'checkbox' ? $field.checked : $field.value;
}
