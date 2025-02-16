import * as Shortcut from './shortcut.js';
import * as Storage from '../storage.js';
import { GroupMap } from '../utils.js';
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
//@ (String) -> (Any)
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

//@ (Object) -> (Boolean), state
function validateRegex($field) {
    try {
        new RegExp($field.value);
        $field.setCustomValidity('');
        $field.classList.remove('error');
        return true;
    } catch (e) {
        $field.setCustomValidity('Invalid regular expression');
        $field.reportValidity();
        $field.classList.add('error');
        return false;
    }
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
        return Storage.set({ [$field.name]: value });
    },
};

// Maps enabler fields to arrays of target fields.
// An enabler enables/disables fields that have a data-enabled-by="{enabler_name}" attribute.
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
        this.group($enabler, $target);
        this._updateTarget($target, $enabler.disabled || !$enabler[relevantProp($enabler.type)]);
    },

    // Enable/disable fields that $enabler controls and save their associated settings.
    // Return true if no save failures.
    //@ (Object), state -> (Boolean), state|nil
    async trigger($enabler) {
        const $targets = this.get($enabler);
        if (!$targets)
            return true;
        // Disable targets if enabler is unchecked, empty or is itself disabled
        const disable = $enabler.disabled || !$enabler[relevantProp($enabler.type)];
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
    permissionInfo: { permissions: ['bookmarks'] },

    //@ state -> (Boolean)
    hasPermission: async () => (await browser.permissions.getAll()).permissions.includes('bookmarks'),

    //@ state -> state
    async onNoPermission() {
        const $enable_stash = $form.enable_stash;
        $enable_stash.checked = false;
        enablerMap.trigger($enable_stash);
        Setting.save($enable_stash);
    },

    //@ (Object), state -> state|nil
    async onEnabled($enable_stash) {
        if (!$enable_stash.checked)
            return browser.permissions.remove(StashSection.permissionInfo);
        $enable_stash.checked = await browser.permissions.request(StashSection.permissionInfo);
    },
};

const StaticText = {

    //@ state -> state
    async insertShortcuts() {
        const $templateSource = document.getElementById('shortcut');
        const $template = $templateSource.content.firstElementChild;
        const $fragment = document.createDocumentFragment();
        for (const { description, shortcut, defaultShortcut } of Object.values(await Shortcut.getDict())) {
            const $shortcut = $template.cloneNode(true);
            $shortcut.querySelector('.shortcut-description').textContent = description;
            $shortcut.querySelector('.shortcut-key').innerHTML = Shortcut.format(shortcut);
            if (defaultShortcut) {
                $shortcut.querySelector('.shortcut-default-text').hidden = false;
                $shortcut.querySelector('.shortcut-default').innerHTML = Shortcut.format(defaultShortcut);
            }
            $fragment.appendChild($shortcut);
        }
        $templateSource.parentNode.insertBefore($fragment, $templateSource.nextSibling); // Insert $fragment after $templateSource
    },

    //@ state -> state
    async checkPrivateAccess() {
        const isAllowed = await browser.extension.isAllowedIncognitoAccess();
        const $toShow = $form.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
        $toShow.forEach($el => $el.hidden = false);
    },
};


(async function init() {
    const SETTINGS = await Storage.getDict(Storage.DEFAULT_SETTINGS);
    for (const $field of Setting.$fields) {
        Setting.load(SETTINGS[$field.name], $field);
        enablerMap.addTarget($field);
    }
    if ($form.enable_stash.checked && !await StashSection.hasPermission())
        StashSection.onNoPermission();
    StaticText.insertShortcuts();
    StaticText.checkPrivateAccess();
})();

browser.permissions.onRemoved.addListener(({ permissions }) => {
    if (permissions.includes('bookmarks'))
        StashSection.onNoPermission();
});

$form.addEventListener('change', async ({ target: $field }) => {
    const fieldName = $field.name;

    // Before save
    switch (fieldName) {
        case 'badge_regex':
            if (!validateRegex($field))
                return;
        case 'enable_stash':
            await StashSection.onEnabled($field);
    }

    // Save
    const isAllSaved = (
        await Promise.all([ enablerMap.trigger($field), Setting.save($field) ])
    ).every(Boolean);
    if (isAllSaved)
        indicateSuccess($field.closest('.flex') || $field.closest('label'));

    // After save
    switch (fieldName) {
        case 'set_title_preface':
            if (!$field.checked) {
                browser.runtime.sendMessage({ type: 'clearTitlePreface' });
                return;
            }
        case 'title_preface_prefix':
        case 'title_preface_postfix':
        case 'assert_title_preface':
        case 'show_badge':
        case 'badge_show_emoji_first':
        case 'badge_regex':
        case 'badge_regex_gflag':
            browser.runtime.sendMessage({ type: 'update' });
            return;

        case 'discard_minimized_window':
            if (!$field.checked) {
                browser.runtime.sendMessage({ type: 'discardMinimized', enabled: false });
                return;
            }
        case 'discard_minimized_window_delay_mins':
            if ($form.discard_minimized_window.checked)
                browser.runtime.sendMessage({ type: 'discardMinimized', enabled: true });
            return;

        case 'theme':
            document.body.classList.toggle('dark', isDark($form.theme.value));
            return;

        case 'enable_stash':
        case 'stash_home_folder':
        case 'stash_home_root':
            if ($form.enable_stash.checked)
                browser.runtime.sendMessage({ type: 'stashInit' });
            return;
    }
});

$form.addEventListener('click', ({ target: $el }) => {
    if ($el.classList.contains('help'))
        return openHelp($el.getAttribute('href'));
    if ($el.id === 'restart')
        browser.runtime.reload();
});
