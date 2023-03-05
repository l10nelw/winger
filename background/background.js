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

initPerSettings();
initOpenWindows();

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(Winfo.saveLastFocused);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.runtime.onInstalled.addListener(onExtensionInstalled);
browser.runtime.onMessage.addListener(onRequest);

//@ state -> state
async function initPerSettings() {
    const settings = await Settings.getAll();

    if (settings.show_badge)
        Chrome.showBadge();

    if (settings.enable_stash) {
        [Stash, UnstashMenu] = await Promise.all([ import('./stash.js'), import('./menu.unstash.js') ]);
        Stash.init(settings);
    }
}

// Update chromes with names; save created and lastFocused timestamps if needed.
// Resolve any name duplication, in case any named windows were restored while Winger was not active.
//@ state -> state
async function initOpenWindows() {
    const winfos = await Winfo.get(['focused', 'created', 'givenName']);
    const nameMap = new Name.NameMap();

    // winfos should be in id-ascending order, which shall be assumed as age-descending; the newer of any duplicate pair found is renamed
    for (let { id, focused, created, givenName } of winfos) {
        if (givenName && nameMap.findId(givenName)) {
            givenName = nameMap.uniquify(givenName);
            Name.save(id, givenName);
        }
        nameMap.set(id, givenName);
        Chrome.update(id, givenName);

        if (!created)
            Winfo.saveCreated(id); // TODO: Not accurate to say they are created at this point; consider calling it FirstSeen

        if (focused)
            Winfo.saveLastFocused(id);
    }
}

//@ (Object) -> state
async function onWindowCreated(window) {
    const windowId = window.id;
    const [focusedTabs, created, winfos] = await Promise.all([
        !await Settings.get('keep_moved_tabs_selected') && browser.tabs.query({ windowId, active: true }),
        Winfo.loadCreated(windowId),
        Winfo.get(['givenName']),
    ]);

    // Natively, detached tabs stay selected; to honour !keep_moved_tabs_selected, REFOCUS focused tab to deselect selected tabs
    if (focusedTabs)
        Action.focusTab(focusedTabs[0].id);

    if (!created)
        Winfo.saveCreated(windowId);

    // Resolve any name duplication and update chrome, in case this is a restored named window
    let { givenName } = winfos.at(-1); // The new window should be last in the array
    if (givenName) {
        // Uniquify name
        const nameMap = (new Name.NameMap()).bulkSet(winfos);
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
        case 'debug':  return debug();
    }
}

//@ state -> ({ Object, [Object], Object })
async function popupResponse() {
    const [winfos, settings] = await Promise.all([
        Winfo.get(['focused', 'givenName', 'incognito', 'lastFocused', 'tabCount']),
        Settings.getAll(),
    ]);
    return { ...Winfo.arrange(winfos), settings };
}