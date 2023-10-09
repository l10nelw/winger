const ALL_DEFAULTS = {

    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    unload_minimized_window: false,
    minimize_kick_window: false,

    title_preface_prefix: '',
    title_preface_postfix: ' - ',
    show_badge: false,

    enable_stash: false,
    stash_home_root: 'toolbar_____',
    stash_home_folder: 'Stashed Windows',

    theme: '',

    // Deprecated, retrieve for migration v2.4.0
    unload_minimized_window_tabs: undefined,
    minimize_kick_windows: undefined,
    stash_home: undefined,
    stash_home_name: undefined,
};

// Map old keys to new keys. v2.4.0
// [ old key, new key, function to get value ]
const ENTRIES_TO_MIGRATE = [
    [
        'unload_minimized_window_tabs',
        'unload_minimized_window',
        settings => settings.unload_minimized_window_tabs,
    ],
    [
        'minimize_kick_windows',
        'minimize_kick_window',
        settings => settings.minimize_kick_windows,
    ],
    [
        'stash_home',
        'stash_home_root',
        settings => settings.stash_home?.split('/')[0],
    ],
    [
        'stash_home_name',
        'stash_home_folder',
        settings => settings.stash_home?.endsWith('/') ? settings.stash_home_name : '',
    ],
];

// Load settings from disk to memory.
//@ state -> (Object), state
export async function init() {
    const settings = await browser.storage.local.get(ALL_DEFAULTS);
    migrate(settings);
    browser.storage.session.set(settings);
    return settings;
}

// Migrate old storage entries to new entries, deleting the former and saving the latter.
// Mutates `settings` by adding new entries.
//@ (Object), state -> (Object), state
function migrate(settings) {
    const newEntryDict = {};
    let hasMigration = false;
    for (const [oldKey, newKey, valueFn] of ENTRIES_TO_MIGRATE) {
        if (settings[oldKey] === undefined)
            continue;
        newEntryDict[newKey] = settings[newKey] = valueFn(settings);
        browser.storage.local.remove(oldKey);
        hasMigration = true;
    }
    for (const [oldKey] of ENTRIES_TO_MIGRATE)
        delete settings[oldKey];
    if (hasMigration)
        browser.storage.local.set(newEntryDict);
    return settings;
}

//@ (Object) -> (Boolean), state
export function set(dict) {
    browser.storage.session.set(dict);
    return browser.storage.local.set(dict).then(() => true).catch(() => false);
}

//@ (String|[String]), state -> (Any|[Any])
export async function getValue(key) {
    if (Array.isArray(key)) {
        const dict = await getDict(arrayToDict(key));
        return Object.values(dict);
    }
    if (!(key in ALL_DEFAULTS))
        return;
    const dict = await getDict({ [key]: ALL_DEFAULTS[key] });
    return dict[key];
}

//@ (Object|[String]|undefined), state -> (Promise: Object)
export function getDict(keys) {
    if (Array.isArray(keys))
        keys = arrayToDict(keys);
    return browser.storage.session.get(keys);
}

//@ ([String]) -> (Object)
function arrayToDict(array) {
    const dict = {};
    for (const key of array)
        dict[key] = ALL_DEFAULTS[key];
    return dict;
}
