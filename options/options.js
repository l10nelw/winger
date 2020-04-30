import * as Settings from '../background/settings.js';

const $form = document.body.querySelector('form');
const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
let SETTINGS;

(async () => {
    SETTINGS = await Settings.retrieve();
    for (const $field of $form.elements) {
        loadSetting($field);
    }
    $form.onchange = onFieldChange;
})();

function onFieldChange(event) {
    const $target = event.target;
    saveSetting($target);
    browser.runtime.reload();
}

function saveSetting($field) {
    const value = $field[relevantProp($field)];
    browser.storage.local.set({ [$field.name]: value });
}

function loadSetting($field) {
    $field[relevantProp($field)] = SETTINGS[$field.name];
}
