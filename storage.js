export const DEFAULT_SETTINGS = {

    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    unload_minimized_window: false,
    minimize_kick_window: false,

    show_badge: false,
    set_title_preface: undefined,
    title_preface_prefix: '',
    title_preface_postfix: ' - ',

    enable_stash: false,
    stash_home_root: 'toolbar_____',
    stash_home_folder: 'Stashed Windows',
    stash_nameless_with_title: false,
    auto_name_unstash: true,
    show_popup_stash: true,

    theme: '',
};

// Return all stored data, merged with defaults of any unstored settings.
// Migrate/remove legacy data (remnants of past versions) if any.
//@ state -> (Object), state
export async function init() {
    const ALLOWED_NON_SETTINGS_KEYS = [
        '__version',
        '_focused_window_id',
        '_stash_home_id',
    ];
    const ENTRIES_TO_MIGRATE = [
        // v2.4.0
        [
            'unload_minimized_window_tabs',
            'unload_minimized_window',
            dict => dict.unload_minimized_window_tabs,
        ],
        [
            'minimize_kick_windows',
            'minimize_kick_window',
            dict => dict.minimize_kick_windows,
        ],
        [
            'stash_home',
            'stash_home_root',
            dict => dict.stash_home?.split('/')[0],
        ],
        [
            'stash_home_name',
            'stash_home_folder',
            dict => dict.stash_home?.endsWith('/') ? dict.stash_home_name : '',
        ],
    ];
    const ALLOWED_VALUES_DICT = {
        // v2.4.1
        theme: ['', 'dark', 'light'],
    };

    // Get all stored entries plus defaults for missing settings
    const dict = { ...DEFAULT_SETTINGS, ...await getDict() };

    // Migrate old keys to new keys
    // Adds new entries to `dict`
    const migrationDict = {};
    for (const [oldKey, newKey, valueGetter] of ENTRIES_TO_MIGRATE)
        if (oldKey in dict)
            migrationDict[newKey] = dict[newKey] = valueGetter(dict);
    set(migrationDict);

    // Remove old/unused keys from `dict`
    for (const key in dict) {
        if (key in DEFAULT_SETTINGS || ALLOWED_NON_SETTINGS_KEYS.includes(key))
            continue;
        delete dict[key];
        browser.storage.local.remove(key);
    }

    // Reset any invalid values
    for (const [key, allowedValues] of Object.entries(ALLOWED_VALUES_DICT)) {
        if (allowedValues.includes(dict[key]))
            continue;
        const value = allowedValues[0];
        dict[key] = value;
        set({ [key]: value });
    }

    return dict;
}


//@ (Object) -> (Boolean), state
export function set(dict) {
    return browser.storage.local.set(dict).then(() => true).catch(() => false);
}

// Given a keys array or dict, return a dict of keys mapped to their values.
// If `keys` is undefined, return all stored data.
//@ (Object|[String]|undefined), state -> (Promise: Object)
export function getDict(keys) {
    if (Array.isArray(keys))
        keys = settingsArrayToDict(keys);
    return browser.storage.local.get(keys);
}

// Given a key or array of keys, return the respective value or array of values.
//@ (String|[String]), state -> (Any|[Any])
export async function getValue(key) {
    if (Array.isArray(key)) {
        const dict = await browser.storage.local.get(settingsArrayToDict(key));
        return Object.values(dict);
    }
    const dict = await browser.storage.local.get({ [key]: DEFAULT_SETTINGS[key] });
    return dict[key];
}

// Turn an array of settings keys into a dict of keys and default values.
//@ ([String]) -> (Object)
function settingsArrayToDict(keys) {
    const dict = {};
    for (const key of keys)
        dict[key] = DEFAULT_SETTINGS[key];
    return dict;
}
