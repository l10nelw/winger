import './background.init.js';
import './message.js';
import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as StashMenu from './menu.stash.js';
import * as SendMenu from './menu.send.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
browser.windows.onRemoved.addListener(onWindowRemoved);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.commands.onCommand.addListener(onShortcut);
browser.alarms.onAlarm.addListener(onAlarm);

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
    browser.menus.remove(`${windowId}`).catch(() => {});
    Auto.switchList.reset();
}

//@ (Object, Object) -> state|nil
async function onMenuShown(info, tab) {
    await StashMenu.handleShow(info) || SendMenu.handleShow(info);
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
