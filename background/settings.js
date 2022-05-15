const DEFAULT = {

    theme: 'system',

    keep_moved_focused_tab_focused: true,
    keep_moved_tabs_selected: true,
    move_pinned_tabs: 'allow',

    show_badge: false,

    enable_tab_menu: true,
    enable_link_menu: true,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

};

export let SETTINGS;

// Retrieve all settings.
// If not retrieved yet, try to get `settings` object, otherwise try to get v1 settings, otherwise set to default.
//@ state -> state
export async function get() {
    SETTINGS ??= (await browser.storage.local.get('settings'))?.settings || await browser.storage.local.get(DEFAULT);
    return SETTINGS;
}

// Save settings provided as key-value pairs.
//@ (Object) -> state
export function set(settings) {
    return browser.storage.local.set({ settings });
}
