// The storage system:
// `init()` loads all data from local storage, filling any absent values with default values, and places the data in session storage.
// The data can be read from session storage using `getDict()`, `getValue()` and `getValues()`.
// The data can be updated using `set()` which writes to both session and local storage.
// "_"-prefixed data keys are considered temporary (session-only) and are never saved to local storage.

/**
 * Default values of all possible stored properties.
 */
export const STORED_PROPS = {
    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    discard_minimized_window: false,
    discard_minimized_window_delay_mins: 0,
    minimize_kick_window: false,

    show_badge: false,
    badge_show_emoji_first: false,
    badge_regex: '',
    badge_regex_gflag: false,
    set_title_preface: undefined,
    title_preface_prefix: '',
    title_preface_postfix: ' - ',
    assert_title_preface: false,

    enable_stash: false,
    stash_home_root: 'toolbar_____',
    stash_home_folder: 'Stashed Windows',
    stash_nameless_with_title: false,
    auto_name_unstash: true,
    show_popup_stash: true,
    show_popup_stashed_items: false,

    theme: '',
    compact_popup: false,
    open_help_on_update: true,

    // Non-settings. Temporary keys have a "_" prefix.
    // These properties are to be correctly populated at init; the "default values" are only for type inference.
    version: '',
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
        ['__version', 'version', dict => dict.__version], // v2.10.0
    ];

    // Get all entries from local storage, plus defaults for missing settings
    /** @type {typeof STORED_PROPS} */
    const sessionDict = { ...STORED_PROPS, ...await browser.storage.local.get() };

    // Migrate obsolete keys to new keys
    // Adds new entries to `dict`
    /** @type {Partial<STORED_PROPS>} */ const migrationDict = {};
    let needMigrate = false;
    for (const [oldKey, newKey, valueGetter] of ENTRIES_TO_MIGRATE) {
        if (oldKey in sessionDict) {
            migrationDict[newKey] = sessionDict[newKey] = valueGetter(sessionDict);
            needMigrate = true;
        }
    }

    // Clean up storage - remove obsolete/invalid keys
    /** @type {Promise<void>[]} */ const removingKeys = [];
    for (const key in sessionDict) {
        if (key in STORED_PROPS) { // Is valid
            if (key.startsWith('_')) // Is temporary
                removingKeys.push(browser.storage.local.remove(key));
            continue;
        }
        delete sessionDict[key];
        removingKeys.push(browser.storage.local.remove(key));
    }

    await Promise.all([
        browser.storage.session.set(sessionDict),
        needMigrate && browser.storage.local.set(migrationDict),
        ...removingKeys,
    ]);
    return sessionDict;
}

/**
 * Save `dict` in session and local (except temproary properties) storage.
 * Return false if anything fails to save, else return true.
 * @param {Partial<STORED_PROPS>} dict
 * @returns {Promise<boolean>}
 */
export async function set(dict) {
    return (await Promise.all([
        browser.storage.local.set(removeTemp(dict)).then(() => true, () => false),
        browser.storage.session.set(dict).then(() => true, () => false),
    ])).every(Boolean);
}

/**
 * @param {Partial<STORED_PROPS>} dict
 * @returns {Partial<STORED_PROPS>}
 */
function removeTemp(dict) {
    const newDict = {};
    for (const key in dict)
        if (!key.startsWith('_'))
            newDict[key] = dict[key];
    return newDict;
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
 * Given an array of keys, return the respective stored values from session storage.
 * @template {keyof STORED_PROPS} Key
 * @param {Key[]} keys
 * @returns {Promise<(typeof STORED_PROPS[Key])[]>}
 */
export async function getValues(keys) {
    const dict = await browser.storage.session.get(getDefaultsDict(keys));
    return Object.values(dict);
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
