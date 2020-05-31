const DEFAULT = {

    bring_modifier: 'Shift',
    send_modifier: 'Ctrl',

    keep_moved_focused_tab_focused: true,
    keep_moved_tabs_selected: false,
    move_pinned_tabs: false,
    move_pinned_tabs_if_all_pinned: true,

    popup_bring: true,
    popup_send: true,
    popup_edit: true,
    popup_help: true,
    popup_settings: true,

    enable_link_menu: true,
    enable_tab_menu: true,

    show_badge: true,

};

export let SETTINGS;

export async function retrieve() {
    SETTINGS = SETTINGS || { ...await browser.storage.local.get(DEFAULT) };
    return SETTINGS;
}