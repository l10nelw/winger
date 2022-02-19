const DEFAULT = {

    theme: 'system',

    keep_moved_focused_tab_focused: true,
    keep_moved_tabs_selected: true,
    move_pinned_tabs: false,
    move_pinned_tabs_if_all_pinned: true,

    show_popup_bring: true,
    show_popup_send: true,
    show_popup_help: true,
    show_popup_settings: true,

    show_badge: false,

    enable_tab_menu: true,
    enable_link_menu: true,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

};

export let SETTINGS;

//@ state -> state
export async function retrieve() {
    SETTINGS ??= await browser.storage.local.get(DEFAULT);
    return SETTINGS;
}

//@ (Boolean|Undefined), state -> state
export async function needsRestart(value) {
    if (value === undefined) return (await browser.storage.local.get('needs_restart')).needs_restart;
    browser.storage.local.set({ needs_restart: value });
}
