import { getShortcut, hasClass, toggleClass, GroupMap } from '../utils.js';
import { validify } from '../background/name.js';
import { retrieve as retrieveSettings, needsRestart } from '../background/settings.js';
import { openHelp } from '../background/action.js';

const $body = document.body;
const $form = $body.querySelector('form');
const $settings = [...$form.querySelectorAll('.setting')];
const $applyBtns = [...$form.querySelectorAll('.applyBtn')];
const stash_subSymbol = $form.stash_home.options[1].text.slice(-1);
const enablerMap = new GroupMap(); // Fields that enable/disable other fields
const togglerMap = new GroupMap(); // Fields that check/uncheck other fields and change state according to those fields' states
let SETTINGS, formData;

const relevantProp = $field => $field.type === 'checkbox' ? 'checked' : 'value';
const relevantValue = $field => $field[relevantProp($field)];
const getFormValuesString = () => $settings.map(relevantValue).join();

(async () => {
    SETTINGS = await retrieveSettings();

    for (const $field of $settings) {
        loadSetting($field);
        const $enabler = $form[$field.dataset.enabledBy];
        if ($enabler) { // field has enabler
            enablerMap.group($field, $enabler);
            updateEnablerTarget($field, $enabler.disabled || !$enabler.checked);
        }
        const $toggler = $form[$field.dataset.toggledBy];
        if ($toggler) { // field has toggler
            togglerMap.group($field, $toggler);
        }
    }
    for (const $toggler of togglerMap.keys()) updateToggler($toggler);
    stash_updateHomeSelect();

    formData = getFormValuesString();
    updateApplyBtns();
})();

$form.onchange = onFieldChange;
$form.onclick = onElClick;
$form.onsubmit = applySettings;
staticText_insertShortcut();
staticText_checkPrivateAccess();

async function onFieldChange({ target: $field }) {
    await stash_onChecked($field);
    stash_updateHomeSelect();
    activateEnabler($field);
    activateToggler($field);
    updateToggler($form[$field.dataset.toggledBy]);
    saveSetting($field);
    updateApplyBtns();
}

function onElClick({ target: $el }) {
    if (hasClass('help', $el)) openHelp($el.getAttribute('href'));
}

function applySettings() {
    browser.runtime.reload();
}

function loadSetting($field) {
    $field[relevantProp($field)] = SETTINGS[$field.name];
}

function saveSetting($field) {
    if (hasClass('setting', $field))
        browser.storage.local.set({ [$field.name]: relevantValue($field) });
}

 // Disable submit buttons if restart unneeded or form unchanged. Enable otherwise.
async function updateApplyBtns() {
    const disable = await needsRestart() ? false : getFormValuesString() === formData;
    for (const $btn of $applyBtns) $btn.disabled = disable;
    needsRestart(!disable);
}

// Enable/disable fields that $enabler controls.
function activateEnabler($enabler) {
    const $targets = enablerMap.get($enabler);
    if (!$targets) return;
    const disable = $enabler.disabled || !$enabler.checked; // Disable targets if enabler is unchecked or is itself disabled
    for (const $target of $targets) {
        updateEnablerTarget($target, disable);
        activateEnabler($target); // In case $target is itself an enabler
    }
}

function updateEnablerTarget($field, disable) {
    $field.disabled = disable;
    toggleClass('muted', $field.closest('label'), disable);
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

async function stash_onChecked($field) {
    if ($field !== $form.enable_stash) return;
    const permission = { permissions: ['bookmarks'] };
    if (!$field.checked) return browser.permissions.remove(permission);
    $field.checked = await browser.permissions.request(permission);
}

// Add/update subfolder name in the stash home <select>.
function stash_updateHomeSelect() {
    const name = validify($form.stash_home_name.value);
    $form.stash_home_name.value = name;
    for (const $option of $form.stash_home.options)
        if (!$option.value.endsWith('_'))
            $option.text = `${$option.previousElementSibling.text} ${stash_subSymbol} ${name}`;
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