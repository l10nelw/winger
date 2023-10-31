import * as Winfo from './winfo.js';
import * as Action from './action.js';
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
browser.windows.onFocusChanged.addListener(Winfo.saveLastFocused);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.runtime.onInstalled.addListener(onExtensionInstalled);
browser.runtime.onMessage.addListener(onRequest);
browser.runtime.onMessageExternal.addListener(onExternalRequest);

//@ state -> state
async function init() {
    const [settings, winfos] = await Promise.all([
        Settings.getAll(),
        Winfo.getAll(['focused', 'firstSeen', 'givenName', 'titlePreface']),
    ]);

    // Respond to settings
    Chrome.init(settings);
    if (settings.enable_stash) {
        [Stash, UnstashMenu] = await Promise.all([ import('./stash.js'), import('./menu.unstash.js') ]);
        Stash.init(settings);
    }

    const nameMap = new Name.NameMap();
    for (let { id, focused, firstSeen, givenName } of winfos) {
        if (focused)
            Winfo.saveLastFocused(id);
        if (!firstSeen)
            Winfo.saveFirstSeen(id);

        if (givenName && nameMap.findId(givenName)) {
            givenName = nameMap.uniquify(givenName);
            Name.save(id, givenName);
        }
        nameMap.set(id, givenName);
        // Chrome.update(id, givenName);
    }

    const titlePrefaceMap = (new Name.TitlePrefaceMap()).populate(winfos);
}

//@ (Object) -> state
async function onWindowCreated(window) {
    const windowId = window.id;
    const [focusedTabs, firstSeen, winfos] = await Promise.all([
        !await Settings.get('keep_moved_tabs_selected') && browser.tabs.query({ windowId, active: true }),
        Winfo.loadFirstSeen(windowId),
        Winfo.getAll(['givenName']),
    ]);

    // Natively, detached tabs stay selected; to honour !keep_moved_tabs_selected, REFOCUS focused tab to deselect selected tabs
    if (focusedTabs)
        Action.focusTab(focusedTabs[0].id);

    if (!firstSeen)
        Winfo.saveFirstSeen(windowId);

    // Resolve any name duplication and update the chrome, in case this is a restored named window
    let { givenName } = winfos.at(-1); // The new window should be last in the array
    if (givenName) {
        // Uniquify name
        const nameMap = (new Name.NameMap()).populate(winfos);
        if (nameMap.findId(givenName) !== windowId)
            Name.save(id, nameMap.uniquify(givenName));
        Chrome.update(windowId, givenName);
    }

    // In Firefox, windows cannot be created focused=false so a new window is always focused
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
    if (details.reason === 'install')
        Action.openHelp();
}

//@ (Object), state -> (Object|Boolean|undefined), state|nil
function onRequest(request) {
    switch (request.type) {
        case 'popup':  return popupResponse();
        case 'stash':  return Stash.stash(request.windowId, request.close);
        case 'action': return Action.execute(request);
        case 'help':   return Action.openHelp();
        case 'update': return Chrome.update(request.windowId, request.name);
        case 'warn':   return Chrome.showWarningBadge();
        case 'debug':  return debug();
    }
}

const POPUP_WINFO_PROPS = ['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'type'];

//@ state -> ({ Object, [Object], Object })
async function popupResponse() {
    const [winfos, settings] = await Promise.all([ Winfo.getAll(POPUP_WINFO_PROPS), Settings.getAll() ]);
    return { ...Winfo.arrange(winfos), settings };
}

//@ (Object), state -> (Promise: [Object]|Error)
function onExternalRequest(request) {
    switch (request.type) {
        case 'info': return Winfo.getForExternal(request.properties, request.windowIds);
    }
    return Promise.reject(new Error(`Missing or unrecognized 'type'`));
}
