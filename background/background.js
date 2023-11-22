import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as UnstashMenu from './menu.unstash.js';
import * as SendMenu from './menu.send.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';

//@ -> state
function debug() {
    const modules = { Storage, Winfo, Name, Action, SendMenu, Stash, UnstashMenu };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(window, modules);
}

init();

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.runtime.onMessage.addListener(onRequest);
browser.runtime.onMessageExternal.addListener(onExternalRequest);

//@ state -> state
async function init() {
    const [info, winfos] = await Promise.all([
        Storage.init(),
        Winfo.getAll(['focused', 'firstSeen', 'givenName', 'minimized']),
    ]);

    Stash.init(info);

    // Update chromes with names; resolve any name duplication, in case any named windows were restored while Winger was not active
    // winfos should be in id-ascending order, which shall be assumed as age-descending; the newer of any duplicate pair found is renamed

    const nameMap = new Name.NameMap();

    for (let { id, focused, firstSeen, givenName, minimized } of winfos) {
        if (givenName && nameMap.findId(givenName)) {
            givenName = nameMap.uniquify(givenName);
            Name.save(id, givenName);
        }
        nameMap.set(id, givenName);

        if (focused) {
            Storage.set({ _focused_window_id: id });
            Winfo.saveLastFocused(id);
        }

        if (!firstSeen)
            Winfo.saveFirstSeen(id);

        if (minimized && info.unload_minimized_window)
            Auto.unloadWindow(id);
    }
    Chrome.update(nameMap);

    // Open help page if major or minor version has changed
    const version = browser.runtime.getManifest().version;
    if (version.split('.', 2).join('.') !== info.__version?.split('.', 2).join('.')) {
        Action.openHelp();
        Storage.set({ __version: version });
    }
}

//@ (Object) -> state
async function onWindowCreated(window) {
    const windowId = window.id;
    const [_, firstSeen, winfos] = await Promise.all([
        handleDetachedTabs(windowId), // In case window created from detached tabs
        Winfo.loadFirstSeen(windowId),
        Winfo.getAll(['givenName']),
    ]);

    if (!firstSeen)
        Winfo.saveFirstSeen(windowId);

    // Resolve any name duplication and update chrome, in case this is a restored named window
    let { givenName } = winfos.at(-1); // The new window should be last in the array
    if (givenName) {
        // Uniquify name
        const nameMap = (new Name.NameMap()).populate(winfos);
        if (nameMap.findId(givenName) !== windowId)
            Name.save(id, nameMap.uniquify(givenName));

        Chrome.update([[windowId, givenName]]);
    }
}

// Natively, detached tabs stay selected. To honour !keep_moved_tabs_selected, REFOCUS focused tab to deselect selected tabs.
//@ (Number) -> state
async function handleDetachedTabs(windowId) {
    if (await Storage.getValue('keep_moved_tabs_selected'))
        return;
    const focusedTab = (await browser.tabs.query({ windowId, active: true }))[0];
    if (focusedTab)
        Action.focusTab(focusedTab.id);
}

//@ (Number), state -> state|nil
async function onWindowFocusChanged(windowId) {
    // windowId is -1 when a window loses focus in Windows/Linux, or when no window has focus in MacOS
    if (windowId <= 0)
        return;

    if (await Storage.getValue('unload_minimized_window')) {
        const defocusedWindowId = await Storage.getValue('_focused_window_id');
        if (await isMinimized(defocusedWindowId))
            Auto.unloadWindow(defocusedWindowId);
    }

    Storage.set({ _focused_window_id: windowId });
    Winfo.saveLastFocused(windowId);
}

//@ (Number), state -> (Boolean)
const isMinimized = async windowId => (await browser.windows.get(windowId).catch(() => null))?.state === 'minimized';

//@ (Object, Object) -> state|nil
async function onMenuShown(info, tab) {
    await UnstashMenu.handleShow(info) || await SendMenu.handleShow(info, tab);
}

//@ -> state
function onMenuHidden() {
    SendMenu.handleHide();
    UnstashMenu.handleHide();
}

//@ (Object, Object) -> state|nil
function onMenuClicked(info, tab) {
    UnstashMenu.handleClick(info) || SendMenu.handleClick(info, tab);
}

//@ (Object), state -> (Object|Boolean|undefined), state|nil
async function onRequest(request) {
    switch (request.type) {
        case 'popup': {
            const [winfos, settings, allowedPrivate] = await Promise.all([
                Winfo.getAll(['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'titleSansName', 'type']),
                Storage.getDict(['show_popup_bring', 'show_popup_send', 'enable_stash']),
                browser.extension.isAllowedIncognitoAccess(),
            ]);
            return { ...Winfo.arrange(winfos), settings, allowedPrivate };
        }
        case 'stash':
            return Stash.stash(request.windowId, request.close);
        case 'stashInit': {
            const settings = await Storage.getDict(['enable_stash', 'stash_home_root', 'stash_home_folder']);
            return Stash.init(settings);
        }
        case 'action':
            return Action.execute(request);
        case 'help':
            return Action.openHelp();
        case 'update': {
            const { windowId, name } = request;
            if (windowId && name)
                return Chrome.update([[windowId, name]]);
            const winfos = await Winfo.getAll(['givenName']);
            const nameMap = (new Name.NameMap()).populate(winfos);
            return Chrome.update(nameMap);
        }
        case 'warn':
            return Chrome.showWarningBadge();
        case 'debug':
            return debug();
    }
}

//@ (Object), state -> (Promise: [Object]|Error)
function onExternalRequest(request) {
    switch (request.type) {
        case 'info': {
            // Return winfos with the specified `properties` (required [String])
            // If `windowIds` (optional [Number]) given, return only the winfos for them

            const { properties } = request;
            if (!Array.isArray(properties))
                return Promise.reject(new Error('`properties` array is required'));

            const { windowIds } = request;
            if (windowIds && !windowIds.every?.(Number.isInteger))
                return Promise.reject(new Error('`windowIds` must be an array of integers'));

            const bareWinfos = windowIds?.map(id => ({ id }));
            return Winfo.getAll(properties, bareWinfos);
        }
    }
    return Promise.reject(new Error('Missing or unrecognized `type`'));
}
