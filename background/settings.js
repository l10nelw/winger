const DEFAULT = {

    popup_bring: true,
    popup_send: true,
    popup_edit: true,
    popup_help: true,
    popup_settings: true,

    bring_modifier: 'Shift',
    send_modifier: 'Ctrl',

    // enable_tab_menu: true,
    // enable_link_menu: true,

    // show_badge: true,

    move_pinned_tabs: true,
    keep_moved_active_tab_active: true,
    keep_moved_tabs_selected: false,
};

export let SETTINGS;

export async function retrieve() {
    if (!SETTINGS) SETTINGS = { ...DEFAULT, ...await browser.storage.local.get(DEFAULT) };
    return SETTINGS;
}