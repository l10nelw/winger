import './background.init.js';
import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as StashMenu from './menu.stash.js';
import * as SendMenu from './menu.send.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';

//@ -> state
async function debug() {
    const [Auto, StashProp] = await Promise.all([
        import('./action.auto.js'),
        import('./stash.prop.js'),
    ]);
    const modules = { Storage, Winfo, Name, Action, Auto, Chrome, SendMenu, StashMenu, Stash, StashProp };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(window, modules);
}

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
browser.windows.onRemoved.addListener(onWindowRemoved);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.alarms.onAlarm.addListener(onAlarm);

browser.runtime.onMessage.addListener(onRequest);
browser.runtime.onMessageExternal.addListener(onExternalRequest);

//@ (Object) -> state
async function onWindowCreated(window) {
    const windowId = window.id;

    handleDetachedTabs(windowId); // In case window created from detached tabs

    const [firstSeen, winfos] = await Promise.all([
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

    const [discard_minimized_window, set_title_preface] = await Storage.getValue(['discard_minimized_window', 'set_title_preface']);

    if (discard_minimized_window) {
        Auto.discardWindow.deschedule(windowId); // Cancel any scheduled discard of now-focused window
        const defocusedWindowId = await Storage.getValue('_focused_window_id');
        if (await isMinimized(defocusedWindowId))
            Auto.discardWindow.schedule(defocusedWindowId);
    }

    // Record window focus state and time
    Storage.set({ _focused_window_id: windowId });
    Winfo.saveLastFocused(windowId);

    if (set_title_preface) {
        // Reapply titlePreface in case it's missing for any reason
        const givenName = await browser.sessions.getWindowValue(windowId, 'givenName') || '';
        Chrome.update([[windowId, givenName]]);
    }
}

//@ (Number), state -> (Boolean)
const isMinimized = async windowId => (await browser.windows.get(windowId).catch(() => null))?.state === 'minimized';

//@ (Number) -> state
function onWindowRemoved(windowId) {
    browser.menus.remove(`${windowId}`);
}

//@ (Object, Object) -> state|nil
async function onMenuShown(info, tab) {
    await StashMenu.handleShow(info) || await SendMenu.handleShow(info, tab);
}

//@ -> state
function onMenuHidden() {
    SendMenu.handleHide();
    StashMenu.handleHide();
}

//@ (Object, Object) -> state|nil
async function onMenuClicked(info, tab) {
    await StashMenu.handleClick(info) || SendMenu.handleClick(info, tab);
}

//@ (Object) -> state
async function onAlarm({ name }) {
    const [action, id] = name.split('-');
    switch (action) {
        case 'discardWindow':
            if (await Storage.getValue('discard_minimized_window'))
                Auto.discardWindow.now(+id);
            return;
    }
}

//@ (Object), state -> (Object|Boolean|undefined), state|nil
async function onRequest(request) {
    switch (request.type) {
        case 'popup': {
            const [flags, allow_private] = await Promise.all([
                Storage.getDict(['show_popup_bring', 'show_popup_send', 'set_title_preface', 'enable_stash', 'show_popup_stash']),
                browser.extension.isAllowedIncognitoAccess(),
            ]);
            flags.allow_private = allow_private;
            const winfoProps = ['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'type'];
            winfoProps.push(flags.set_title_preface ? 'titleSansName' : 'title');
            if (!flags.enable_stash)
                delete flags.show_popup_stash;
            return { ...Winfo.arrange(await Winfo.getAll(winfoProps)), flags };
        }

        case 'stash':
            return Stash.stashWindow(request.windowId, request.name, request.close);

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

        case 'clearTitlePreface':
            return Chrome.clearTitlePreface();

        case 'discardMinimized':
            if (request.enabled) {
                for (const { id, minimized } of await Winfo.getAll(['minimized']))
                    if (minimized)
                        Auto.discardWindow.schedule(id);
            } else {
                for (const { name } of await browser.alarms.getAll())
                    if (name.startsWith('discardWindow'))
                        browser.alarms.clear(name);
            }
            return;

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
