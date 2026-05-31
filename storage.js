// The storage system:
// `init()` loads all data from local storage, filling any absent values with default values, and places the data in session storage.
// The data can be read from session storage using `getDict()` and `getValue()`.
// The data can be updated using `set()` which writes to both session and local storage.
// "_"-prefixed data keys are considered temporary (session-only) and are never saved to local storage.

/**
 * Default values of all possible stored properties, settings and non-settings.
 */
export const STORED_PROPS = {
    show_popup_bring_btn: true,
    show_popup_send_btn: true,
    keep_moved_tabs_selected: true,

    discard_minimized_window: false,
    discard_minimized_window_delay_mins: 0,
    minimize_kick_window: false,

    show_badge: false,
    badge_show_emoji_first: false,
    badge_regex: '',
    badge_regex_gflag: false,
    set_title_preface: /** @type {boolean | undefined} */ (undefined),
    title_preface_prefix: '',
    title_preface_postfix: ' - ',
    assert_title_preface: false,

    enable_stash: false,
    stash_home_root_id: 'toolbar_____',
    stash_home_folder_title: 'Stashed Windows',
    stash_nameless_with_title: false,
    auto_name_unstash: true,
    unstash_load_eager: false,
    show_popup_stash_btn: true,
    show_popup_stashed_items: false,

    theme: '',
    compact_popup: false,
    open_help_on_update: true,

    // Non-settings, must be "_" prefixed
    // These properties are to be correctly populated at init; the "default values" are only for type inference
    _version: '',
    _focusedWindowId: 0,
};

/**
 * Get all data in local storage, merged with defaults of any unstored settings, and place the data in session storage.
 * Migrate/remove legacy data (remnants of past versions) if any.
 * @returns {Promise<typeof STORED_PROPS>}
 */
export async function init() {
    /** @type {[oldKey: string, newKey: string, valueGetter: Function][]} */
    const ENTRIES_TO_MIGRATE = [
        ['__version', '_version', dict => dict.__version], // v2.12.0
        ['stash_home_root', 'stash_home_root_id', dict => dict.stash_home_root], // v2.12.0
        ['stash_home_folder', 'stash_home_folder_title', dict => dict.stash_home_folder], // v2.12.0
        ['show_popup_bring', 'show_popup_bring_btn', dict => dict.show_popup_bring], // v2.12.0
        ['show_popup_send', 'show_popup_send_btn', dict => dict.show_popup_send], // v2.12.0
        ['show_popup_stash', 'show_popup_stash_btn', dict => dict.show_popup_stash], // v2.12.0
    ];

    // Get all entries from local storage, plus defaults for missing settings
    /** @type {typeof STORED_PROPS} */
    const sessionDict = { ...STORED_PROPS, ...await browser.storage.local.get() };

    // Migrate obsolete keys to new keys
    // Adds new entries to `dict`
    /** @type {Partial<STORED_PROPS>} */
    const migrationDict = {};
    for (const [oldKey, newKey, valueGetter] of ENTRIES_TO_MIGRATE) if (oldKey in sessionDict)
        migrationDict[newKey] = sessionDict[newKey] = valueGetter(sessionDict);

    /** @type {Promise<void>[]} */
    const promises = [
        browser.storage.session.set(sessionDict),
        browser.storage.local.set(migrationDict),
    ];
    // Clean up storage - remove obsolete/invalid keys
    for (const key in sessionDict) if (!(key in STORED_PROPS)) {
        delete sessionDict[key];
        promises.push(browser.storage.local.remove(key));
    }
    await Promise.all(promises);

    return sessionDict;
}

/**
 * Save `dict` in session and local storage.
 * Return false if anything fails to save, else return true.
 * @param {Partial<STORED_PROPS>} dict
 * @returns {Promise<boolean>}
 */
export async function set(dict) {
    return (await Promise.all([
        browser.storage.local.set(dict).then(() => true, () => false),
        browser.storage.session.set(dict).then(() => true, () => false),
    ])).every(Boolean);
}

/**
 * Given a `keys` array or dict, return a dict of keys mapped to their stored values, from session storage.
 * If `keys` not given, return all stored data from session storage.
 * @template {keyof STORED_PROPS} Key
 * @param {Key[] | Partial<STORED_PROPS>} [keys]
 * @returns {Promise<Partial<STORED_PROPS>>}
 */
export function getDict(keys) {
    if (Array.isArray(keys))
        keys = getDefaultsDict(keys);
    return browser.storage.session.get(keys);
}

/**
 * Get the value for a given key from session storage, falling back to the default if not set.
 * @template {keyof STORED_PROPS} Key
 * @param {Key} key
 * @returns {Promise<typeof STORED_PROPS[Key]>}
 */
export async function getValue(key) {
    const dict = await browser.storage.session.get({ [key]: STORED_PROPS[key] });
    return dict[key];
}

/**
 * Turn an array of settings keys into a dict of keys and default values.
 * @param {(keyof STORED_PROPS)[]} keys
 * @returns {Partial<STORED_PROPS>}
 */
function getDefaultsDict(keys) {
    const dict = {};
    for (const key of keys)
        dict[key] = STORED_PROPS[key];
    return dict;
}

/**
 * @typedef PopupConfig
 * @property {boolean} allow_private
 * @property {boolean} compact_popup
 * @property {boolean} set_title_preface
 * @property {boolean} show_popup_bring_btn
 * @property {boolean} show_popup_send_btn
 * @property {boolean} [enable_stash]
 * @property {boolean} [show_popup_stash_btn]
 * @property {boolean} [show_popup_stashed_items]
 */
/**
 * Get dict of settings used by the popup.
 * @returns {Promise<PopupConfig>}
 */
export async function getPopupConfig() {
    const POPUP_SETTING_KEYS = [
        'compact_popup',
        'set_title_preface',
        'show_popup_bring_btn',
        'show_popup_send_btn',
        'enable_stash',
        'show_popup_stash_btn',
        'show_popup_stashed_items',
    ];
    /** @type {[PopupConfig, boolean]} */
    const [config, allow_private] = await Promise.all([
        getDict(POPUP_SETTING_KEYS),
        browser.extension.isAllowedIncognitoAccess(),
    ]);
    config.allow_private = allow_private;

    // If stashing not enabled, remove stash-related settings from config, making them all falsey
    if (!config.enable_stash)
        for (const key in config) if (key.includes('stash'))
            delete config[key];

    return config;
}
