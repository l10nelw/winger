import * as Settings from './settings.js';
import * as Window from './window.js';
import * as Name from './name.js';
import * as Action from './action.js';
import * as Chrome from './chrome.js';
let Stash, Menu; // Optional modules

//@ -> state
function debug() {
    const modules = { Settings, Window, Name, Action, Stash, Menu };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(window, modules);
}

init();
browser.runtime.onInstalled.addListener    (onExtensionInstalled);
browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);
browser.runtime.onMessage.addListener      (onRequest);

//@ state -> state
async function init() {
    const [SETTINGS, windows] = await Promise.all([ Settings.get(), browser.windows.getAll() ]);

    Action.init(SETTINGS);
    Chrome.init(SETTINGS);

    if (SETTINGS.enable_stash) {
        import('./stash.js').then(module => {
            Stash = module;
            Stash.init(SETTINGS);
        });
    }
    const menusEnabled = [];
    if (SETTINGS.enable_tab_menu)  menusEnabled.push('tab');
    if (SETTINGS.enable_link_menu) menusEnabled.push('link');
    if (SETTINGS.enable_stash)     menusEnabled.push('bookmark');
    if (menusEnabled.length) {
        import('./menu.js').then(module => {
            Menu = module;
            Menu.init(menusEnabled);
        });
    }

    await Window.add(windows);
    for (const window of windows) onWindowCreated(window, true);
}

//@ (Object) -> state
function onExtensionInstalled(details) {
    if (details.reason === 'install') Action.openHelp();
}

//@ (Object, Boolean), state -> state
async function onWindowCreated(window, isInit) {
    const windowId = window.id;
    if (window.focused) onWindowFocused(windowId);

    if (isInit) return;

    await Window.add([window]);
    Action.selectFocusedTab(windowId);
    Menu?.update();
    Stash?.unstash.onWindowCreated(windowId);
}

//@ (Number), state -> state
function onWindowRemoved(windowId) {
    Window.remove(windowId);
    Menu?.update();
}

//@ (Number), state -> state
function onWindowFocused(windowId) {
    if (windowId in Window.winfoDict) Window.winfoDict[windowId].lastFocused = Date.now();
}

//@ (Object), state -> (Promise: Object|Boolean|null), state|null
async function onRequest(request) {
    if (request.popup) return {
        SETTINGS:         Settings.SETTINGS,
        winfos:           Window.sortedWinfos(),
        selectedTabCount: (await Action.getSelectedTabs()).length,
    };
    if (request.stash)     return Stash.stash(request.stash, request.close);
    if (request.action)    return Action.execute(request);
    if (request.help)      return Action.openHelp();
    if (request.pop)       return Action.pop(request.incognito);
    if (request.checkName) return Name.check(request.checkName, request.name);
    if (request.setName)   return Name.set(request.setName, request.name);
    if (request.debug)     return debug();
}
