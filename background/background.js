import * as Settings from './settings.js';
import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Chrome from './chrome.js';
import * as SendMenu from './menu.send.js';
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

//@ state -> state
async function init() {
    const [SETTINGS, winfos] = await Promise.all([ Settings.get(), Winfo.get(['focused', 'created', 'givenName']) ]);

    // Init per settings
    if (SETTINGS.enable_stash) {
        [Stash, UnstashMenu] = await Promise.all([ import('./stash.js'), import('./menu.unstash.js') ]);
        Stash.init(SETTINGS);
    }
    if (SETTINGS.show_badge)
        Chrome.showBadge();

    // Init existing windows
    for (const { id, focused, created, givenName } of uniquifyAllNames(winfos)) {
        if (givenName)
            Chrome.update(id, givenName);
        if (!created)
            Winfo.saveCreated(id); // TODO: Not accurate to say they are created at this point; consider calling it FirstSeen
        if (focused)
            Winfo.saveLastFocused(id);
    }

    // Resolve any duplicate names, in case named windows were restored while Winger was not active.
    // The newer of any duplicate pair found is renamed.
    //@ ([Object]) -> state|nil
    function uniquifyAllNames(winfos) {
        const nameMap = new Name.NameMap();
        // `winfos` should be in id-ascending order, which shall be assumed as age-descending
        for (let { id, givenName } of winfos) {
            if (nameMap.findId(givenName)) {
                givenName = nameMap.uniquify(givenName);
                Name.save(id, givenName);
            }
            nameMap.set(id, givenName);
        }
        return winfos;
    }
}

//@ (Object) -> state
async function onWindowCreated(window) {
    const windowId = window.id;

    const promises = [ Winfo.get(['givenName']), Winfo.loadCreated(windowId) ];
    if (!Settings.SETTINGS.keep_moved_tabs_selected)
        promises.push( browser.tabs.query({ windowId, active: true }) );
    const [winfos, created, focusedTab] = await Promise.all(promises);

    if (!created)
        Winfo.saveCreated(windowId);

    // Natively, detached tabs stay selected; to honour !SETTINGS.keep_moved_tabs_selected, REFOCUS focused tab to deselect selected tabs
    if (focusedTab)
        Action.focusTab(focusedTab[0].id);

    // In Firefox, windows cannot be created focused=false so a new window is always focused
    Winfo.saveLastFocused(windowId);

    // Follow up if window created via unstashing
    Stash?.unstash.onWindowCreated(windowId);

    const winfo = winfos.at(-1); // The new window should be last in the array
    let givenName = winfo.givenName;
    if (givenName) {
        // Uniquify name, in case this is a restored named window
        const nameMap = (new Name.NameMap()).bulkSet(winfos);
        if (nameMap.findId(givenName) !== windowId)
            Name.save(id, nameMap.uniquify(givenName));

        Chrome.update(windowId, givenName);
    }
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
        case 'popup':     return popupResponse();
        case 'stash':     return Stash.stash(request.windowId, request.close);
        case 'action':    return Action.execute(request);
        case 'help':      return Action.openHelp();
        case 'update':    return Chrome.update(request.windowId, request.name);
        case 'settings':  return Settings.SETTINGS;
        case 'debug':     return debug();
    }
}

//@ state -> ({ Object, [Object], Object })
async function popupResponse() {
    const winfos = Winfo.arrange(
        await Winfo.get(['focused', 'givenName', 'incognito', 'lastFocused', 'tabCount'])
    );
    winfos.SETTINGS = Settings.SETTINGS;
    return winfos;
}