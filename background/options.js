const DEFAULT = {

    bringtab_modifier: 'Ctrl',
    sendtab_modifier: 'Alt',

    // enable_tab_menu: true,
    // enable_link_menu: true,

    // show_badge: true,

    move_pinned_tabs: true,
    keep_sent_tabs_selected: false,
};

export let OPTIONS;

export async function retrieveOptions() {
    if (!OPTIONS) OPTIONS = { ...DEFAULT, ...await browser.storage.local.get() };
    return OPTIONS;
}