import * as Settings from '../background/settings.js';

const $form = document.body.querySelector('form');
const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
let SETTINGS;

(async () => {
    SETTINGS = await Settings.retrieve();
    for (const $field of $form.elements) {
        loadSetting($field);
        setRelatedFieldAccess($field);
    }
})();

$form.onchange = onFieldChange;
$form.onsubmit = browser.runtime.reload;

function onFieldChange(event) {
    const $field = event.target;
    saveSetting($field);
    setRelatedFieldAccess($field);
}

function saveSetting($field) {
    const value = $field[relevantProp($field)];
    browser.storage.local.set({ [$field.name]: value });
}

function loadSetting($field) {
    $field[relevantProp($field)] = SETTINGS[$field.name];
}

function setRelatedFieldAccess($field) {
    const $related = $form[$field.dataset.enables];
    if ($related) $related.disabled = !$field.checked;
}