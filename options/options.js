import { getShortcut, hasClass, GroupMap } from '../utils.js';
import * as Settings from '../background/settings.js';

const $body = document.body;
const $form = $body.querySelector('form');
const $settings = [...$form.querySelectorAll('.setting')];
const $submitBtns = [...$form.querySelectorAll('button')];
const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
const getFormValuesString = () => $settings.map($field => $field[relevantProp($field)]).join();
const enablerMap = new GroupMap(); // Fields that enable/disable other fields
const togglerMap = new GroupMap(); // Fields that check/uncheck other fields and change state according to those fields' states
let SETTINGS, formData;

(async () => {
    SETTINGS = await Settings.retrieve();
    for (const $field of $settings) {
        loadSetting($field);
        const $enabler = $form[$field.dataset.enabledBy];
        if ($enabler) {
            enablerMap.group($field, $enabler);
            $field.disabled = !$enabler.checked;
        }
        const $toggler = $form[$field.dataset.toggledBy];
        if ($toggler) {
            togglerMap.group($field, $toggler);
        }
    }
    for (const $toggler of togglerMap.keys()) updateToggler($toggler);
    formData = getFormValuesString();
})();

$form.onchange = onFieldChange;
$form.onsubmit = applySettings;
staticText_insertShortcut();
staticText_checkPrivateAccess();

function onFieldChange({ target: $field }) {
    activateEnabler($field);
    activateToggler($field);
    updateToggler($form[$field.dataset.toggledBy]);
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

// Enable/disable fields that $enabler controls.
function activateEnabler($enabler) {
    const $targets = enablerMap.get($enabler);
    if (!$targets) return;
    const disable = !$enabler.checked;
    $targets.forEach($target => $target.disabled = disable);
}

// Check/uncheck fields that $toggler controls.
function activateToggler($toggler) {
    const $targets = togglerMap.get($toggler);
    if (!$targets) return;
    const check = $toggler.checked;
    $targets.forEach($target => {
        $target.checked = check;
        saveSetting($target);
    });
}

// Update $toggler state based on the states of the fields it controls.
function updateToggler($toggler) {
    const $targets = togglerMap.get($toggler);
    if (!$targets) return;
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

async function staticText_insertShortcut() {
    const shortcut = await getShortcut();
    if (shortcut) $body.querySelector('.shortcut').textContent = shortcut;
    const $defaultShortcutText = $body.querySelector('.default-shortcut-text');
    const defaultShortcut = browser.runtime.getManifest().commands._execute_browser_action.suggested_key.default;
    if (shortcut == defaultShortcut) return;
    $defaultShortcutText.querySelector('.default-shortcut').textContent = defaultShortcut;
    $defaultShortcutText.hidden = false;
}

async function staticText_checkPrivateAccess() {
    const isAllowed = await browser.extension.isAllowedIncognitoAccess();
    const $toShow = $body.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
    $toShow.forEach($el => $el.hidden = false);
}