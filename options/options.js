import * as Settings from '../settings.js';
import { getShortcut, GroupMap } from '../utils.js';
import { openHelp } from '../background/action.js';
import { isDark } from '../theme.js';
import indicateSuccess from '../success.js';

const $form = document.body.querySelector('form');

const relevantProp = type => (type === 'checkbox') ? 'checked' : 'value';

const PARSE_CONSTANTS = Object.entries({
    true: true,
    false: false,
    null: null,
    undefined: undefined,
});
function parse(value) {
    if (value === '')
        return '';
    for (const [key, val] of PARSE_CONSTANTS) // Is it one of these words or values?
        if (value === val || value === key)
            return val;
    if (Number.isFinite(value)) // Is it already a number?
        return value;
    const number = +value;
    if (!isNaN(number))
        return number;
    return value;
}

const Setting = {
    $fields: [...$form.querySelectorAll('.setting')],

    //@ (Boolean|String, Object) -> state
    load(value, $field) {
        if ($field.type === 'radio')
            $field.checked = ($field.value === `${value}`);
        else
            $field[relevantProp($field.type)] = value;
    },

    //@ (Object) ->  (Promise:Boolean | undefined), state
    save($field) {
        if (!$field.classList.contains('setting'))
            return;
        if ($field.type === 'radio' && !$field.checked)
            return;
        const value = parse($field[relevantProp($field.type)]);
        return Settings.set({ [$field.name]: value });
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

    // Enable/disable fields that $enabler controls and save their associated settings.
    // Return true if no save failures.
    //@ (Object), state -> (Boolean), state|nil
    async trigger($enabler) {
        const $targets = this.get($enabler);
        if (!$targets)
            return true;
        // Disable targets if enabler is unchecked or is itself disabled
        const disable = $enabler.disabled || !$enabler.checked;
        const saving = [];
        for (const $target of $targets) {
            this._updateTarget($target, disable);
            this.trigger($target); // In case $target is itself an enabler
            saving.push(Setting.save($target));
        }
        return (await Promise.all(saving)).every(Boolean);
    },
});

const StashSection = {
    permission: { permissions: ['bookmarks'] },

    //@ (Object), state -> state|nil
    async onEnabled($field) {
        if ($field !== $form.enable_stash)
            return;
        if (!$field.checked)
            return browser.permissions.remove(StashSection.permission);
        $field.checked = await browser.permissions.request(StashSection.permission);
    },
};

const StaticText = {

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
    const SETTINGS = await Settings.getDict();

    for (const $field of Setting.$fields) {
        Setting.load(SETTINGS[$field.name], $field);
        enablerMap.addTarget($field);
    }

    StaticText.insertShortcut();
    StaticText.checkPrivateAccess();
})();

$form.addEventListener('change', async ({ target: $field }) => {
    await StashSection.onEnabled($field);

    const isAllSaved = (
        await Promise.all([ enablerMap.trigger($field), Setting.save($field) ])
    ).every(Boolean);
    if (isAllSaved)
        indicateSuccess($field.closest('.inline-fields') || $field.closest('label'));

    switch ($field.name) {
        case 'title_preface_prefix':
        case 'title_preface_postfix':
        case 'show_badge':
            browser.runtime.sendMessage({ type: 'update' });
            return;

        case 'theme':
            document.body.classList.toggle('dark', isDark($form.theme.value));
            return;

        case 'stash_home_folder':
        case 'stash_home_root':
            browser.runtime.sendMessage({ type: 'stashInit' });
            return;
    }
});

$form.addEventListener('click', ({ target: $el }) => {
    if ($el.classList.contains('help'))
        return openHelp($el.getAttribute('href'));
});
