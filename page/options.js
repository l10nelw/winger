import * as Shortcut from './shortcut.js';
import * as Storage from '../storage.js';
import { GroupMap } from '../utils.js';
import { openHelp } from '../background/action.js';
import { isDark } from '../theme.js';
import indicateSuccess from '../success.js';

/** @type {HTMLFormElement} */
const $form = document.body.querySelector('form');

/**
 * @param {string} type
 * @returns {'checked' | 'value'}
 */
const relevantProp = type => (type === 'checkbox') ? 'checked' : 'value';

const PARSE_CONSTANTS = Object.entries({
    true: true,
    false: false,
    null: null,
    undefined: undefined,
});

/**
 * @param {string} value
 * @returns {any}
 */
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

/**
 * @param {HTMLInputElement} $field
 * @returns {boolean}
 */
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

/**
 * @namespace Setting
 */
const Setting = {
    /** @type {HTMLInputElement[]} */
    $fields: [...$form.querySelectorAll('.setting')],

    /**
     * @param {string | boolean} value
     * @param {HTMLInputElement} $field
     * @modifies $field
     */
    load(value, $field) {
        if ($field.type === 'radio')
            $field.checked = ($field.value === `${value}`);
        else
            $field[relevantProp($field.type)] = value;
    },

    /**
     * @param {HTMLInputElement} $field
     * @returns {Promise<boolean?>}
     */
    save($field) {
        if (!$field.classList.contains('setting'))
            return;
        if ($field.type === 'radio' && !$field.checked)
            return;
        const value = parse($field[relevantProp($field.type)]);
        return Storage.set({ [$field.name]: value });
    },
};

/**
 * Maps enabler fields to arrays of target fields.
 * An enabler enables/disables fields that have a `data-enabled-by="{enabler_name}"` attribute.
 * @type {Map<HTMLInputElement, HTMLInputElement[]>}
 */
const enablerMap = Object.assign(new GroupMap(), {
    /**
     * @param {HTMLInputElement} $target
     * @param {boolean} disable
     * @modifies $target
     * @private
     */
    _updateTarget($target, disable) {
        $target.disabled = disable;
        $target.closest('label')?.classList.toggle('muted', disable);
    },

    /**
     * @param {HTMLInputElement} $target
     * @modifies this
     */
    addTarget($target) {
        const $enabler = $form[$target.dataset.enabledBy];
        if (!$enabler)
            return;
        this.group($enabler, $target);
        this._updateTarget($target, $enabler.disabled || !$enabler[relevantProp($enabler.type)]);
    },

    /**
     * Enable/disable fields that $enabler controls and save their associated settings.
     * Return true if no save failures.
     * @param {HTMLInputElement} $enabler
     * @returns {boolean}
     * @modifies $enabler
     */
    async trigger($enabler) {
        /** @type {HTMLInputElement[]} */
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

/**
 * @namespace StashSection
 */
const StashSection = {
    /** @constant */
    permissionInfo: { permissions: ['bookmarks'] },

    /**
     * @returns {Promise<boolean>}
     */
    hasPermission: async () => (await browser.permissions.getAll()).permissions.includes('bookmarks'),

    onNoPermission() {
        /** @type {HTMLInputElement} */
        const $enable_stash = $form.enable_stash;
        $enable_stash.checked = false;
        enablerMap.trigger($enable_stash);
        Setting.save($enable_stash);
    },

    /**
     * @param {HTMLInputElement} $enable_stash
     */
    async onEnabled($enable_stash) {
        if (!$enable_stash.checked)
            return browser.permissions.remove(StashSection.permissionInfo);
        $enable_stash.checked = await browser.permissions.request(StashSection.permissionInfo);
    },
};

/**
 * @namespace StaticText
 */
const StaticText = {

    async insertShortcuts() {
        /** @type {HTMLElement}      */ const $templateSource = document.getElementById('shortcut');
        /** @type {HTMLElement}      */ const $template = $templateSource.content.firstElementChild;
        /** @type {DocumentFragment} */ const $fragment = document.createDocumentFragment();
        for (const { description, shortcut, defaultShortcut } of Object.values(await Shortcut.getDict())) {
            const $shortcut = $template.cloneNode(true);
            $shortcut.querySelector('.shortcut-description').textContent = description;
            $shortcut.querySelector('.shortcut-key').replaceChildren(Shortcut.formatHTML(shortcut));
            if (defaultShortcut) {
                $shortcut.querySelector('.shortcut-default-text').hidden = false;
                $shortcut.querySelector('.shortcut-default').replaceChildren(Shortcut.formatHTML(defaultShortcut));
            }
            $fragment.appendChild($shortcut);
        }
        $templateSource.parentNode.insertBefore($fragment, $templateSource.nextSibling); // Insert $fragment after $templateSource
    },

    async checkPrivateAccess() {
        /** @type {boolean}     */ const isAllowed = await browser.extension.isAllowedIncognitoAccess();
        /** @type {HTMLElement} */ const $toShow = $form.querySelectorAll(`.private-allowed-${isAllowed ? 'yes' : 'no'}`);
        $toShow.forEach($el => $el.hidden = false);
    },
};

const BadgeRegex = {
    /** @type {HTMLInputElement} */
    $field: $form.badge_regex,

    /** @type {HTMLInputElement} */
    $checkbox: $form.querySelector('input[data-checked-by="badge_regex"]'),

    update() {
        BadgeRegex.$checkbox.checked = BadgeRegex.$field.value !== '';
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
    BadgeRegex.update();
})();

browser.permissions.onRemoved.addListener(
    /**
     * @param {Object} permissionsObject
     * @param {string[]} permissionsObject.permissions
     */
    ({ permissions }) => {
        if (permissions.includes('bookmarks'))
            StashSection.onNoPermission();
    }
);

$form.addEventListener('change',
    /**
     * @param {Object} event
     * @param {HTMLInputElement} event.target
     */
    async ({ target: $field }) => {
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
        /** @type {boolean} */
        const isAllSaved = (
            await Promise.all([ enablerMap.trigger($field), Setting.save($field) ])
        ).every(Boolean);
        if (isAllSaved)
            indicateSuccess($field.closest('.flex') || $field.closest('label'));

        // After save
        switch (fieldName) {
            case 'set_title_preface':
                if (!$field.checked) {
                    browser.runtime.sendMessage({ type: 'clear', component: 'TitlePreface' });
                    return;
                }
            case 'title_preface_prefix':
            case 'title_preface_postfix':
            case 'assert_title_preface':
            case 'show_badge':
                if (!$field.checked) {
                    browser.runtime.sendMessage({ type: 'clear', component: 'Badge' });
                    return;
                }
            case 'badge_show_emoji_first':
            case 'badge_regex':
            case 'badge_regex_gflag':
                BadgeRegex.update();
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
    }
);

$form.addEventListener('click',
    /**
     * @param {Object} event
     * @param {HTMLElement} event.target
     */
    ({ target: $el }) => {
        if ($el.matches('.help'))
            return openHelp($el.getAttribute('href'));
        if ($el.closest('.shortcut-key'))
            return browser.commands.openShortcutSettings();
        if ($el.id === 'restart')
            browser.runtime.reload();
    }
);
