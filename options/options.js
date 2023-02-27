import * as Settings from '../settings.js';
import { getShortcut, GroupMap } from '../utils.js';
import { validify } from '../name.js';
import { openHelp } from '../background/action.js';

const $form = document.body.querySelector('form');

const setting = {
    $fields: [...$form.querySelectorAll('.setting')],
    _relevantProp: type => (type === 'checkbox') ? 'checked' : 'value',

    //@ (Boolean|String, Object) -> state
    load(value, $field) {
        const type = $field.type;
        if (type === 'radio')
            $field.checked = ($field.value === `${value}`); // Stringify any non-string
        else
            $field[this._relevantProp(type)] = value;
    },

    //@ (Object) -> state
    save($field) {
        if (!$field.classList.contains('setting'))
            return;
        const { type, name } = $field;
        if (type === 'radio') {
            // Any 'true' or 'false' string is booleanised
            const value = ({ true: true, false: false })[$field.value] ?? $field.value;
            if ($field.checked)
                return Settings.set({ [name]: value });
        }
        Settings.set({ [name]: $field[this._relevantProp(type)] });
    },
};

// Maps enabler fields to arrays of target fields.
// Enablers are checkboxes that enable/disable fields with data-enabled-by="{enabler_name}" attribute.
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
    //@ (Object), state -> state|nil
    trigger($enabler) {
        const $targets = this.get($enabler);
        if (!$targets)
            return;
        // Disable targets if enabler is unchecked or is itself disabled
        const disable = $enabler.disabled || !$enabler.checked;
        for (const $target of $targets) {
            this._updateTarget($target, disable);
            this.trigger($target); // In case $target is itself an enabler
            setting.save($target);
        }
    },
});

const stashSection = {
    permission: { permissions: ['bookmarks'] },
    subfolderSymbol: $form.stash_home.options[1].text.slice(-1),

    //@ (Object), state -> state|nil
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
        for (const $option of $form.stash_home.options)
            if (isSubfolder($option))
                $option.text = `${$option.previousElementSibling.text} ${this.subfolderSymbol} ${name}`;
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
    const SETTINGS = await Settings.getAll();
    for (const $field of setting.$fields) {
        setting.load(SETTINGS[$field.name], $field);
        enablerMap.addTarget($field);
    }
    stashSection.updateHomeSelect();
    staticText.insertShortcut();
    staticText.checkPrivateAccess();
})();

$form.addEventListener('change', async ({ target: $field }) => {
    await stashSection.onEnabled($field);
    enablerMap.trigger($field);
    setting.save($field);
});

$form.addEventListener('click', ({ target: $el }) => {
    if ($el.classList.contains('help'))
        return openHelp($el.getAttribute('href'));
});

$form.addEventListener('submit', () => browser.runtime.reload());
