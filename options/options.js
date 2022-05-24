import * as Settings from '../background/settings.js';
import * as Theme from '../theme.js';
import { getShortcut, GroupMap } from '../utils.js';
import { validify } from '../background/name.js';
import { openHelp } from '../background/action.js';

const $form = document.body.querySelector('form');
const $settingFields = [...$form.querySelectorAll('.setting')];

// Checkboxes that enable/disable other fields
const enablerMap = Object.assign(new GroupMap(), {

    //@ (Object, Boolean) -> state
    updateTarget($target, disable) {
        $target.disabled = disable;
        $target.closest('label')?.classList.toggle('muted', disable);
    },

    //@ (Object), state -> state
    addTarget($target) {
        const $enabler = $form[$target.dataset.enabledBy];
        if (!$enabler) return;
        this.group($target, $enabler);
        this.updateTarget($target, $enabler.disabled || !$enabler.checked);
    },

    // Enable/disable fields that $enabler controls.
    //@ (Object), state -> state|null
    activate($enabler) {
        const $targets = this.get($enabler);
        if (!$targets) return;
        const disable = $enabler.disabled || !$enabler.checked; // Disable targets if enabler is unchecked or is itself disabled
        for (const $target of $targets) {
            this.updateTarget($target, disable);
            this.activate($target); // In case $target is itself an enabler
        }
    },
});

// Checkboxes that tick/untick other checkboxes
const togglerMap = Object.assign(new GroupMap(), {

    //@ (Object), state -> state
    addTarget($targets) {
        const $toggler = $form[$targets.dataset.toggledBy];
        if ($toggler)
            this.group($targets, $toggler);
    },

    // Check/uncheck fields that $toggler controls.
    //@ (Object), state -> state|null
    activate($toggler) {
        const $targets = this.get($toggler);
        if (!$targets) return;
        const check = $toggler.checked;
        $targets.forEach($target => $target.checked = check);
    },
});

const stashSection = {
    permission: { permissions: ['bookmarks'] },
    subfolderSymbol: $form.stash_home.options[1].text.slice(-1),

    // Permission request done here because attempts to do it upon submit have not been successful.
    // Any mismatch of setting and permission states is resolved after extension is reloaded.
    //@ (Object), state -> state|null
    async onEnabled($field) {
        if ($field !== $form.enable_stash) return;
        if (!$field.checked) return browser.permissions.remove(this.permission);
        $field.checked = await browser.permissions.request(this.permission);
    },

    // Add/update subfolder name in the stash home <select>.
    //@ state -> state
    updateHomeSelect() {
        const name = $form.stash_home_name.value = validify($form.stash_home_name.value);
        const isSubfolder = $option => !$option.value.endsWith('_');
        for (const $option of $form.stash_home.options) {
            if (isSubfolder($option))
                $option.text = `${$option.previousElementSibling.text} ${this.subfolderSymbol} ${name}`;
        }
    }
};

(async function init() {
    // Settings already retrieved and checked at background init
    const SETTINGS = await browser.runtime.sendMessage({ settings: true });
    Theme.apply(SETTINGS.theme);
    for (const $field of $settingFields) {
        loadSetting($field);
        enablerMap.addTarget($field);
        togglerMap.addTarget($field);
    }

    stashSection.updateHomeSelect();
    staticText_insertShortcut();
    staticText_checkPrivateAccess();

    //@ (Object), state -> state
    function loadSetting($field) {
        const value = SETTINGS[$field.name];
        const type = $field.type;
        if (type === 'radio')
            $field.checked = $field.value === value;
        else
            $field[type === 'checkbox' ? 'checked' : 'value'] = value;
    }
})();

$form.onchange = onFieldChange;
$form.onclick = onElClick;
$form.onsubmit = saveSettings;

//@ ({ Object }), state -> state
async function onFieldChange({ target: $field }) {
    await stashSection.onEnabled($field);
    enablerMap.activate($field);
    togglerMap.activate($field);
}

//@ ({ Object }), state -> state|null
function onElClick({ target: $el }) {
    if ($el.classList.contains('help'))
        openHelp($el.getAttribute('href'));
}

//@ state -> state
function saveSettings() {
    const newSettings = {};
    for (const $field of $settingFields) {
        const type = $field.type;
        if (type === 'radio') {
            if ($field.checked)
                newSettings[$field.name] = $field.value;
        } else {
            newSettings[$field.name] = $field[type === 'checkbox' ? 'checked' : 'value'];
        }
    }
    Settings.set(newSettings);
    browser.runtime.reload();
}

//@ state -> state
async function staticText_insertShortcut() {
    const defaultShortcut = browser.runtime.getManifest().commands._execute_browser_action.suggested_key.default;
    const currentShortcut = await getShortcut();
    if (currentShortcut) $form.querySelector('.current-shortcut').textContent = currentShortcut;
    if (currentShortcut == defaultShortcut) return;
    const $defaultShortcutText = $form.querySelector('.default-shortcut-text');
    $defaultShortcutText.querySelector('.default-shortcut').textContent = defaultShortcut;
    $defaultShortcutText.hidden = false;
}

//@ state -> state
async function staticText_checkPrivateAccess() {
    const isAllowed = await browser.extension.isAllowedIncognitoAccess();
    const $toShow = $form.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
    $toShow.forEach($el => $el.hidden = false);
}