const DEFAULT = {

    keep_moved_tabs_selected: true,
    show_popup_bring: true,
    show_popup_send: true,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

    show_badge: false,
    theme: 'system',

};

export let SETTINGS;

// Retrieve all settings.
//@ state -> state
export async function get() {
    SETTINGS ??= await browser.storage.local.get(DEFAULT);
    return SETTINGS;
}

// Save settings provided as key-value pairs.
//@ (Object) -> state
export function set(dict) {
    return browser.storage.local.set(dict);
}
