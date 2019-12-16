import { retrieveOptions } from '../background/options.js';

const $form = document.querySelector('form');
init();


async function init() {
    const options = await retrieveOptions();
    for (const name in options) {
        setFieldValue(name, options[name]);
    }
    $form.onchange = onOptionChange;
}

function onOptionChange(event) {
    storeOption(event);
    browser.runtime.reload();
}

function storeOption(event) {
    const name = event.target.name;
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
