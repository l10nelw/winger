const ALL_DEFAULTS = {

    show_popup_bring: true,
    show_popup_send: true,
    keep_moved_tabs_selected: true,

    unload_minimized_window_tabs: false,
    minimize_kick_windows: false,

    show_badge: false,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',

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
