const DEFAULT = {
    enable_tab_menu: true,
    enable_link_menu: true,
    show_badge: true,
};

export let OPTIONS;

export async function retrieveOptions() {
    if (!OPTIONS) OPTIONS = { ...DEFAULT, ...await browser.storage.local.get() };
    return OPTIONS;
}