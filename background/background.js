import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as SendMenu from './menu.send.js';
import * as Settings from '../settings.js';
import * as Name from '../name.js';
let Stash, UnstashMenu; // Optional modules

//@ -> state
function debug() {
    const modules = { Settings, Winfo, Name, Action, SendMenu, Stash, UnstashMenu };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(window, modules);
}

init();

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.runtime.onInstalled.addListener(onExtensionInstalled);
browser.runtime.onMessage.addListener(onRequest);
browser.runtime.onMessageExternal.addListener(onExternalRequest);

//@ state -> state
async function init() {
    const [settings, winfos] = await Promise.all([
        Settings.getDict(),
        Winfo.getAll(['focused', 'firstSeen', 'givenName', 'minimized']),
    ]);
    await Settings.migrate(settings);

    if (settings.enable_stash) {
        [Stash, UnstashMenu] = await Promise.all([ import('./stash.js'), import('./menu.unstash.js') ]);
        Stash.init(settings);
    }

    // Update chromes with names; resolve any name duplication, in case any named windows were restored while Winger was not active
    // winfos should be in id-ascending order, which shall be assumed as age-descending; the newer of any duplicate pair found is renamed

    const nameMap = new Name.NameMap();

    for (let { id, focused, firstSeen, givenName, minimized } of winfos) {
        if (givenName && nameMap.findId(givenName)) {
            givenName = nameMap.uniquify(givenName);
            Name.save(id, givenName);
        }
        nameMap.set(id, givenName);

        if (focused)
            Winfo.saveLastFocused(id);

        if (!firstSeen)
            Winfo.saveFirstSeen(id);

        if (minimized && settings.unload_minimized_window)
            Auto.unloadWindow(id);
    }
    Chrome.update(nameMap);
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
    if (await Settings.getValue('keep_moved_tabs_selected'))
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

    if (await Settings.getValue('unload_minimized_window')) {
        const defocusedWindowId = await loadFocusedWindowId();
        if (await isMinimized(defocusedWindowId))
            Auto.unloadWindow(defocusedWindowId);
    }

    saveFocusedWindowId(windowId);
    Winfo.saveLastFocused(windowId);
}

//@ (Object, Object) -> state|nil
async function onMenuShown(info, tab) {
    await UnstashMenu?.handleShow(info) || await SendMenu.handleShow(info, tab);
}

//@ -> state
function onMenuHidden() {
    SendMenu.handleHide();
    UnstashMenu?.handleHide();
}

//@ (Object, Object) -> state|nil
function onMenuClicked(info, tab) {
    UnstashMenu?.handleClick(info) || SendMenu.handleClick(info, tab);
}

//@ (Object) -> state
function onExtensionInstalled(details) {
    if (details.reason === 'update')
        Action.openHelp();
}

//@ (Object), state -> (Object|Boolean|undefined), state|nil
async function onRequest(request) {
    switch (request.type) {
        case 'popup': {
            const [winfos, settings] = await Promise.all([
                Winfo.getAll(['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'titleSansName', 'type']),
                Settings.getDict(['show_popup_bring', 'show_popup_send', 'enable_stash']),
            ]);
            return { ...Winfo.arrange(winfos), settings };
        }
        case 'stash':
            return Stash.stash(request.windowId, request.close);
        case 'stashInit': {
            const settings = await Settings.getDict(['enable_stash', 'stash_home', 'stash_home_name']);
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

//@ (Number), state -> (Boolean)
const isMinimized = async windowId => (await browser.windows.get(windowId).catch(() => null))?.state === 'minimized';
//@ (Number) -> state
const saveFocusedWindowId = windowId => browser.storage.local.set({ focusedWindowId: windowId });
//@ state -> (Number)
const loadFocusedWindowId = async () => (await browser.storage.local.get('focusedWindowId')).focusedWindowId;
