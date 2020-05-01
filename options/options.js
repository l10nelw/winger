import * as Settings from '../background/settings.js';

const $form = document.body.querySelector('form');
const $fields = [...$form.querySelectorAll('input')];
const $submitBtns = [...$form.querySelectorAll('button')];
const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
const getFormValuesString = () => $fields.map($field => $field[relevantProp($field)]).join();
let SETTINGS, formData;

(async () => {
    SETTINGS = await Settings.retrieve();
    for (const $field of $fields) {
        loadSetting($field);
        setRelatedFieldAccess($field);
    }
    formData = getFormValuesString();
})();

$form.onchange = onFieldChange;
$form.onsubmit = onFormSubmit;

function onFieldChange(event) {
    setRelatedFieldAccess(event.target);
    updateSubmitBtns();
}

function onFormSubmit() {
    $fields.forEach(saveSetting);
    browser.runtime.reload();
}

function loadSetting($field) {
    $field[relevantProp($field)] = SETTINGS[$field.name];
}

function saveSetting($field) {
    browser.storage.local.set({ [$field.name]: $field[relevantProp($field)] });
}

function setRelatedFieldAccess($field) {
    const $related = $form[$field.dataset.enables];
    if ($related) $related.disabled = !$field.checked;
}

function updateSubmitBtns() {
    const isFormUnchanged = formData === getFormValuesString();
    $submitBtns.forEach($btn => $btn.disabled = isFormUnchanged);
}