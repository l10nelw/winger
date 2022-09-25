import * as Settings from '../background/settings.js';
import * as Theme from '../theme.js';
import { getShortcut, GroupMap } from '../utils.js';
import { validify } from '../background/name.js';
import { openHelp } from '../background/action.js';

const $form = document.body.querySelector('form');

const settings = {
    $fields: [...$form.querySelectorAll('.setting')],
    _relevantProp: type => (type === 'checkbox') ? 'checked' : 'value',

    //@ (Boolean|String, Object) -> state
    load(value, $field) {
        $field[this._relevantProp($field.type)] = value;
    },

    //@ state -> state
    saveAll() {
        const newSettings = {};
        for (const $field of this.$fields) {
            newSettings[$field.name] = $field[this._relevantProp($field.type)];
        }
        Settings.set(newSettings);
        browser.runtime.reload();
    },
};

// Checkboxes that enable/disable other fields (targets)
const enablerMap = Object.assign(new GroupMap(), {

    //@ (Object, Boolean) -> state
    _updateTarget($target, disable) {
        $target.disabled = disable;
        $target.closest('label')?.classList.toggle('muted', disable);
    },

    //@ (Object), state -> state
    addTarget($target) {
        const $enabler = $form[$target.dataset.enabledBy];
        if (!$enabler)
            return;
        this.group($target, $enabler);
        this._updateTarget($target, $enabler.disabled || !$enabler.checked);
    },

    // Enable/disable fields that $enabler controls.
    //@ (Object), state -> state|null
    trigger($enabler) {
        const $targets = this.get($enabler);
        if (!$targets)
            return;
        // Disable targets if enabler is unchecked or is itself disabled
        const disable = $enabler.disabled || !$enabler.checked;
        for (const $target of $targets) {
            this._updateTarget($target, disable);
            this.trigger($target); // In case $target is itself an enabler
        }
    },
});

const stashSection = {
    permission: { permissions: ['bookmarks'] },
    subfolderSymbol: $form.stash_home.options[1].text.slice(-1),

    //@ (Object), state -> state|null
    async onEnabled($field) {
        if ($field !== $form.enable_stash)
            return;
        if (!$field.checked)
            return browser.permissions.remove(this.permission);
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
    },
};

const staticText = {

    //@ state -> state
    async insertShortcut() {
        const defaultShortcut = browser.runtime.getManifest().commands._execute_browser_action.suggested_key.default;
        const currentShortcut = await getShortcut();
        if (currentShortcut)
            $form.querySelector('.current-shortcut').textContent = currentShortcut;
        if (currentShortcut == defaultShortcut)
            return;
        const $defaultShortcutText = $form.querySelector('.default-shortcut-text');
        $defaultShortcutText.querySelector('.default-shortcut').textContent = defaultShortcut;
        $defaultShortcutText.hidden = false;
    },

    //@ state -> state
    async checkPrivateAccess() {
        const isAllowed = await browser.extension.isAllowedIncognitoAccess();
        const $toShow = $form.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
        $toShow.forEach($el => $el.hidden = false);
    },
};

(async function init() {
    const SETTINGS = await browser.runtime.sendMessage({ settings: true });
    Theme.apply(SETTINGS.theme);
    for (const $field of settings.$fields) {
        settings.load(SETTINGS[$field.name], $field);
        enablerMap.addTarget($field);
    }
    stashSection.updateHomeSelect();
    staticText.insertShortcut();
    staticText.checkPrivateAccess();
})();

$form.addEventListener('change', async ({ target: $field }) => {
    await stashSection.onEnabled($field);
    enablerMap.trigger($field);
});

$form.addEventListener('click', ({ target: $el }) => {
    if ($el.classList.contains('help'))
        return openHelp($el.getAttribute('href'));
});

$form.addEventListener('submit', settings.saveAll);
