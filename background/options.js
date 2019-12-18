const DEFAULT = {
    bring_tab_modifier: 'Ctrl',
    send_tab_modifier: 'Alt',
    enable_tab_menu: true,
    enable_link_menu: true,
    show_badge: true,
};

export let OPTIONS;

export async function retrieveOptions() {
    if (!OPTIONS) OPTIONS = { ...DEFAULT, ...await browser.storage.local.get() };
    return OPTIONS;
}