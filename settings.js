const ALL_DEFAULTS = {

    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    unload_minimized_window: false,
    minimize_kick_window: false,

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

//@ (Object) -> state
export const set = dict => browser.storage.local.set(dict);

//@ state -> (Promise: Object)
export const getAll = (keys = ALL_DEFAULTS) => browser.storage.local.get(keys);

//@ (String), state -> (Any)
export async function get(key) {
    if (!(key in ALL_DEFAULTS))
        return;
    const dict = await browser.storage.local.get({ [key]: ALL_DEFAULTS[key] });
    return dict[key];
}
