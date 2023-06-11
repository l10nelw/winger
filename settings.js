const ALL_DEFAULTS = {

    keep_moved_tabs_selected: true,
    unload_minimized_window_tabs: false,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

    show_badge: false,

    show_popup_bring: true,
    show_popup_send: true,
    theme: '',

};

//@ (Object) -> state
export const set = dict => browser.storage.local.set(dict);

//@ state -> (Promise: Object)
export const getAll = () => browser.storage.local.get(ALL_DEFAULTS);

//@ (String), state -> (Any)
export async function get(key) {
    if (!(key in ALL_DEFAULTS))
        return;
    const dict = await browser.storage.local.get({ [key]: ALL_DEFAULTS[key] });
    return dict[key];
}
