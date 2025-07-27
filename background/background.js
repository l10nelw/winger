import './background.init.js';
import './message.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as SendMenu from './menu.js';
import * as Winfo from './winfo.js';

import * as Storage from '../storage.js';
import * as Name from '../name.js';

/** @import { Tab, Window, WindowId, Winfo } from '../types.js' */

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
browser.windows.onRemoved.addListener(onWindowRemoved);

browser.menus.onShown.addListener(onMenuShown);
browser.menus.onHidden.addListener(onMenuHidden);
browser.menus.onClicked.addListener(onMenuClicked);

browser.commands.onCommand.addListener(onShortcut);
browser.alarms.onAlarm.addListener(onAlarm);

/**
 * @listens browser.windows.onCreated
 * @param {Window} window
 */
async function onWindowCreated(window) {
    const windowId = window.id;

    handleDetachedTabs(windowId); // In case window created from detached tabs

    /** @type {[number?, Winfo[]]} */
    const [firstSeen, winfos] = await Promise.all([
        Winfo.loadFirstSeen(windowId),
        Winfo.getAll(['givenName']),
    ]);

    if (!firstSeen)
        Winfo.saveFirstSeen(windowId);

    // Resolve any name duplication and update the chrome, in case this is a restored named window
    /** @type {Winfo} */
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

/**
 * @param {WindowId} windowId
 */
async function handleDetachedTabs(windowId) {
    // Natively, detached tabs stay selected. To honour `!keep_moved_tabs_selected`, we REFOCUS focused tab to deselect selected tabs.
    if (!await Storage.getValue('keep_moved_tabs_selected')) {
        /** @type {Tab?} */
        const focusedTab = (await browser.tabs.query({ windowId, active: true }))[0];
        if (focusedTab)
            Action.focusTab(focusedTab.id);
    }
}

/**
 * @listens browser.windows.onFocusChanged
 * @param {WindowId} windowId
 */
async function onWindowFocusChanged(windowId) {
    // windowId is -1 when a window loses focus in Windows/Linux, or when no window has focus in MacOS
    if (windowId <= 0)
        return;

    const [discard_minimized_window, set_title_preface, defocusedWindowId] =
        await Storage.getValues(['discard_minimized_window', 'set_title_preface', '_focusedWindowId']);
    /** @type {boolean} */
    const isDefocusedMinimized = (await browser.windows.get(defocusedWindowId).catch(() => null))?.state === 'minimized';

    // Reset `Auto.switchList` if a window was minimized or un-minimized
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
    Storage.set({ _focusedWindowId: windowId });
    Winfo.saveLastFocused(windowId);

    if (set_title_preface && await Storage.getValue('assert_title_preface')) {
        const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
        Chrome.update(nameMap);
    }
}

/**
 * @listens browser.windows.onRemoved
 * @param {WindowId} windowId
 */
function onWindowRemoved(windowId) {
    browser.menus.remove(`${windowId}`).catch(() => {});
    Auto.switchList.reset();
}

/**
 * @listens browser.menus.onShown
 * @param {Object} info
 */
async function onMenuShown(info,) {
    await Stash.Menu?.handleShow(info) || SendMenu.handleShow(info);
}

/**
 * @listens browser.menus.onHidden
 */
function onMenuHidden() {
    SendMenu.handleHide();
    Stash.Menu?.handleHide();
}

/**
 * @listens browser.menus.onClicked
 * @param {Object} info
 * @param {Tab} tab
 */
async function onMenuClicked(info, tab) {
    await Stash.Menu?.handleClick(info) || SendMenu.handleClick(info, tab);
}

/**
 * @listens browser.commands.onCommand
 * @param {string} shortcutName
 * @param {Tab} tab
 */
async function onShortcut(shortcutName, { windowId }) {
    if (shortcutName.startsWith('switch-')) {
        const offset = shortcutName.endsWith('next') ? 1 : -1;
        windowId = await Auto.switchList.getDestination(windowId, offset);
        Auto.switchList.inProgress = true;
        Action.switchWindow({ windowId });
    }
}

/**
 * @listens browser.alarms.onAlarm
 * @param {{ name: string }} alarm
 */
async function onAlarm({ name }) {
    const [action, id] = name.split('-');
    switch (action) {
        case 'discardWindow':
            if (await Storage.getValue('discard_minimized_window'))
                Auto.discardWindow.now(+id);
            return;
    }
}
