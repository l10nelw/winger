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
import { isWindowId, isFolderId } from '../utils.js';

//@ -> state
async function debug() {
    const StashProp = await import('./stash.prop.js');
    const modules = { Action, Auto, Chrome, Name, SendMenu, StashMenu, Stash, StashProp, Storage, Winfo };
    console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
    Object.assign(globalThis, modules);
}

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
browser.windows.onRemoved.addListener(onWindowRemoved);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.commands.onCommand.addListener(onShortcut);
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
    const { givenName } = winfos.pop(); // The new window should be last in the array
    if (givenName) {
        const nameMap = (new Name.NameMap()).populate(winfos);
        const uniqueName = nameMap.uniquify(givenName);
        if (uniqueName !== givenName)
            Name.save(windowId, uniqueName);
        Chrome.update([[windowId, uniqueName]]);
    }

    Auto.switchList.reset();
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

    const [discard_minimized_window, set_title_preface, defocusedWindowId] =
        await Storage.getValue(['discard_minimized_window', 'set_title_preface', '_focused_window_id']);
    const isDefocusedMinimized = (await browser.windows.get(defocusedWindowId).catch(() => null))?.state === 'minimized';

    // Reset Auto.switchList if a window was minimized or un-minimized
    // In a non-shortcut focus change, if the now-focused window is not in the last-populated switchList, that means it used to be minimized and now isn't
    if (!Auto.switchList.inProgress &&
        (isDefocusedMinimized || Auto.switchList.length && !Auto.switchList.includes(windowId)))
            Auto.switchList.reset();
    Auto.switchList.inProgress = false;

    if (discard_minimized_window) {
        Auto.discardWindow.deschedule(windowId); // Cancel any scheduled discard of now-focused window
        if (isDefocusedMinimized)
            Auto.discardWindow.schedule(defocusedWindowId);
    }

    // Record window focus state and time
    Storage.set({ _focused_window_id: windowId });
    Winfo.saveLastFocused(windowId);

    if (set_title_preface && await Storage.getValue('assert_title_preface')) {
        const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
        Chrome.update(nameMap);
    }
}

//@ (Number) -> state
function onWindowRemoved(windowId) {
    browser.menus.remove(`${windowId}`);
    Auto.switchList.reset();
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

//@ (String, Object) -> state
async function onShortcut(shortcutName, { windowId }) {
    if (shortcutName.startsWith('switch-')) {
        const offset = shortcutName.endsWith('next') ? 1 : -1;
        windowId = await Auto.switchList.getDestination(windowId, offset);
        Auto.switchList.inProgress = true;
        Action.switchWindow({ windowId });
    }
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
            let [windows, flags, allow_private] = await Promise.all([
                browser.windows.getAll({ populate: true }),
                Storage.getDict(['show_popup_bring', 'show_popup_send', 'set_title_preface', 'enable_stash', 'show_popup_stash']),
                browser.extension.isAllowedIncognitoAccess(),
            ]);
            if (Stash.nowStashing.size)
                windows = excludeByIds(windows, Stash.nowStashing.values().filter(isWindowId)); // Exclude windows currently being stashed
            flags.allow_private = allow_private;
            const winfoProps = ['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'type'];
            winfoProps.push(flags.set_title_preface ? 'titleSansName' : 'title');
            if (!flags.enable_stash)
                delete flags.show_popup_stash;
            const winfos = await Winfo.getAll(winfoProps, windows);
            return { ...Winfo.arrange(winfos), flags };
        }

        case 'popupStash': {
            const [enable_stash, homeId] = await Storage.getValue(['enable_stash', '_stash_home_id']);
            if (!(enable_stash && homeId))
                return [];
            let folders = await (new Stash.FolderList()).populate(homeId);
            if (Stash.nowStashing.size)
                folders = excludeByIds(folders, Stash.nowUnstashing.values().filter(isFolderId)); // Exclude folders currently being unstashed
            return folders;
        }

        case 'popupStashContents':
            return (new Stash.FolderList()).populate(request.folders.parentId, { bookmarkCount: true }, request.folders);

        case 'action': {
            if (request.folderId) {
                if (request.action === 'send')
                    return Stash.stashSelectedTabs(request.folderId, request.remove);
                if (request.action === 'stash')
                    return Stash.unstashNode(request.folderId, request.remove);
            }
            if (request.action === 'stash')
                return Stash.stashWindow(request.windowId, request.name, request.remove);
            return Action.execute(request);
        }

        case 'help':
            return Action.openHelp();

        case 'update': {
            Auto.switchList.reset();
            const { windowId, name } = request;
            if (windowId && name)
                return Chrome.update([[windowId, name]]);
            const winfos = await Winfo.getAll(['givenName']);
            const nameMap = (new Name.NameMap()).populate(winfos);
            return Chrome.update(nameMap);
        }

        case 'stashInit': {
            const settings = await Storage.getDict(['enable_stash', 'stash_home_root', 'stash_home_folder']);
            return Stash.init(settings);
        }

        case 'clearTitlePreface':
            return Chrome.TitlePreface.clear();

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

// Filter out objects that have given ids.
// More efficient than `objects.filter(o => !ids.has(o.id))`.
//@ ([Object], [Any]|Set(Any)) -> ([Object])
function excludeByIds(objects, ids) {
    if (!(ids.length || ids.size))
        return objects;
    if (!(ids instanceof Set))
        ids = new Set(ids);
    const remainders = [];
    for (let i = 0, n = objects.length; i < n; i++) {
        if (!ids.size) {
            remainders.push(...objects.slice(i));
            break;
        }
        const object = objects[i];
        if (!ids.delete(object.id))
            remainders.push(object);
    }
    return remainders;
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
