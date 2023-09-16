const ALL_DEFAULTS = {

    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    plug_unfocused_window: false,
    plug_unfocused_window_delay_mins: 10,
    unplug_focused_window: false,
    unload_minimized_window: false,
    minimize_kick_window: false,

    title_preface_prefix: '',
    title_preface_postfix: ' - ',
    show_badge: false,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

    theme: '',

    // Deprecated; retrieve only for migration v2.4.0
    unload_minimized_window_tabs: undefined,
    minimize_kick_windows: undefined,
};

// Map old keys to new keys. v2.4.0
const MIGRATE_DICT = {
    unload_minimized_window_tabs: 'unload_minimized_window',
    minimize_kick_windows: 'minimize_kick_window',
};

// Migrate old storage keys to new keys, deleting the former. Mutates `settings`.
//@ (Object), state -> (Object), state
export function migrate(settings) {
    const changeDict = {};
    for (const [oldKey, newKey] of Object.entries(MIGRATE_DICT)) {
        const value = settings[oldKey];
        if (value !== undefined) {
            changeDict[newKey] = value;
            settings[newKey] = value;
            browser.storage.local.remove(oldKey);
        }
    }
    if (Object.keys(changeDict).length)
        set(changeDict);
    return settings;
}

//@ (Object) -> (Boolean), state
export function set(dict) {
    return browser.storage.local.set(dict).then(() => true).catch(() => false);
}

//@ (Object|[String]|undefined), state -> (Promise: Object)
export function getDict(keys = ALL_DEFAULTS) {
    if (Array.isArray(keys))
        keys = arrayToDict(keys);
    return browser.storage.local.get(keys);
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

//@ ([String]) -> (Object)
function arrayToDict(array) {
    const dict = {};
    for (const key of array)
        dict[key] = ALL_DEFAULTS[key];
    return dict;
}
