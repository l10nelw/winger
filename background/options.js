const DEFAULT = {

    bring_modifier: 'Ctrl',
    send_modifier: 'Alt',

    // enable_tab_menu: true,
    // enable_link_menu: true,

    // show_badge: true,

    move_pinned_tabs: true,
    keep_sent_tabs_selected: true,
};

export let OPTIONS;

export async function retrieve() {
    if (!OPTIONS) OPTIONS = { ...DEFAULT, ...await browser.storage.local.get() };
    return OPTIONS;
}