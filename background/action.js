// User actions involving windows and tabs.

import * as Storage from '../storage.js';
import * as Name from '../name.js';
import * as Chrome from './chrome.js';
import * as Auto from './action.auto.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').TabId} TabId */
/** @typedef {import('../types.js').Window} Window */
/** @typedef {import('../types.js').Tab} Tab */
/** @typedef {import('../types.js').ProtoTab} ProtoTab */

/**
 * @param {string} hash
 * @returns {Promise<Tab>}
 */
export const openHelp = hash => Auto.openUniquePage('page/help.html', hash);

/**
 * @param {Object} request
 * @param {WindowId} request.windowId
 * @returns {Promise<Window>}
 */
export const switchWindow = ({ windowId }) => browser.windows.update(windowId, { focused: true });

/**
 * @namespace ACTION_DICT
 * @type {Object<string, (request: Object) => Promise<Window | Tab[] | void>>}
 */
const ACTION_DICT = {
    bring:       bringTabs,
    send:        sendTabs,
    switch:      switchWindow,
    new:         ({ argument: name }) => createWindow({ name }),
    pop:         ({ argument: name }) => createWindow({ name, isMove: true }),
    kick:        ({ argument: name }) => createWindow({ name, isMove: true, focused: false }),
    newnormal:   ({ argument: name }) => createWindow({ name, incognito: false }),
    popnormal:   ({ argument: name }) => createWindow({ name, incognito: false, isMove: true }),
    kicknormal:  ({ argument: name }) => createWindow({ name, incognito: false, isMove: true, focused: false }),
    newprivate:  ({ argument: name }) => createWindow({ name, incognito: true }),
    popprivate:  ({ argument: name }) => createWindow({ name, incognito: true, isMove: true }),
    kickprivate: ({ argument: name }) => createWindow({ name, incognito: true, isMove: true, focused: false }),
};

/**
 * Select action to execute based on content of action request.
 * @param {Object} request
 * @returns {Promise<Window | Tab[] | void>}
 */
export const execute = request => ACTION_DICT[request.action](request);

/**
 * @param {Object} config
 * @param {boolean} [config.focused=true] - If false, minimize the created window.
 * @param {boolean} [config.incognito] - If true, create private window.
 * @param {boolean} [config.isMove] - If true, create window with currently selected tabs.
 * @param {string} [config.name]
 * @returns {Promise<Window>}
 */
export async function createWindow({ name, isMove, focused = true, incognito }) {
    /** @type {[boolean, Window]} */
    const [minimize_kick_window, currentWindow] = await Promise.all([
        Storage.getValue('minimize_kick_window'),
        browser.windows.getLastFocused({ populate: isMove }),
    ]);
    const currentWindowInfo = { windowId: currentWindow.id };
    incognito ??= currentWindow.incognito;

    const kick = !focused;
    const state = (kick && minimize_kick_window) ? 'minimized' : null;
    /** @type {Window}   */ const newWindow = await browser.windows.create({ incognito, state });
    /** @type {WindowId} */ const newWindowId = newWindow.id;

    if (name) {
        Name.save(newWindowId, name);
        Chrome.update([[newWindowId, name]]);
    }

    // Firefox ignores windows.create/update({ focused: false })
    // So if focused=false (i.e. kicked) and minimize_kick_window=false, switch back to current window
    if (kick && !minimize_kick_window)
        switchWindow(currentWindowInfo);

    if (isMove) {
        /** @type {Tab[]} */
        const selectedTabs = currentWindow.tabs.filter(tab => tab.highlighted);

        // If all of the origin window's tabs are to be moved, add a tab to prevent the window from closing
        if (selectedTabs.length === currentWindow.tabs.length)
            await browser.tabs.create(currentWindowInfo);

        await sendTabs({ tabs: selectedTabs, windowId: newWindowId, sendToMinimized: !!state });
        browser.tabs.remove(newWindow.tabs[0].id);
    }

    return newWindow;
}

/**
 * @param {Object} request
 */
async function bringTabs(request) {
    await sendTabs(request) && switchWindow(request);
}

/**
 * Attempt `moveTabs`; if unsuccessful (e.g. windows are of different private statuses) then `reopenTabs`.
 * @param {Object} request
 * @param {WindowId} request.windowId
 * @param {Tab[]} [request.tabs]
 * @param {boolean} [request.sendToMinimized]
 * @returns {Promise<Tab[]>}
 */
async function sendTabs(request) {
    /** @type {[Tab[], [boolean, boolean]]} */
    const [tabs, [keep_moved_tabs_selected, discard_minimized_window]] = await Promise.all([
        request.tabs ?? getSelectedTabs(), // If tabs not given in request, get selected tabs
        Storage.getValue(['keep_moved_tabs_selected', 'discard_minimized_window']),
    ]);
    request.tabs ??= tabs;
    request.keep_moved_tabs_selected = keep_moved_tabs_selected;

    const movedTabs = await moveTabs(request);
    if (movedTabs.length) {
        Auto.assertDiscard(tabs);
        Auto.restoreTabRelations(movedTabs, tabs, true);
        if (discard_minimized_window && request.sendToMinimized)
            Auto.discardWindow.schedule(request.windowId);
        return movedTabs;
    }
    // Move failed so reopen instead
    const reopenedTabs = await reopenTabs(request);
    Auto.restoreTabRelations(reopenedTabs, tabs);
    return reopenedTabs;
}

/**
 * @param {Object} request
 * @param {Tab[]} request.tabs
 * @param {WindowId} request.windowId
 * @param {boolean} request.keep_moved_tabs_selected
 * @returns {Promise<Tab[]>}
 */
async function moveTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    const [pinnedTabs, unpinnedTabs] = splitTabsByPinnedState(tabs);

    // Get destination index for pinned tabs, since they cannot be moved to index -1 if unpinned tabs exist at destination
    const index = pinnedTabs.length ?
        (await browser.tabs.query({ windowId, pinned: true })).length : 0;

    /** @type {Tab[]} */
    const movedTabs = (await Promise.all([
        browser.tabs.move(pinnedTabs.map(tab => tab.id), { windowId, index }),
        browser.tabs.move(unpinnedTabs.map(tab => tab.id), { windowId, index: -1 }),
    ])).flat();

    if (keep_moved_tabs_selected && tabs[0]?.highlighted) {
        const preMoveFocusedTab = tabs.find(tab => tab.active);
        preMoveFocusedTab && focusTab(preMoveFocusedTab.id);
        tabs.forEach(tab => !tab.active && selectTab(tab.id));
    }

    return movedTabs;
}

/**
 * @param {Tab[]} tabs
 * @returns {[Tab[], Tab[]]}
 */
function splitTabsByPinnedState(tabs) {
    const unpinnedIndex = tabs.findIndex(tab => !tab.pinned);
    if (unpinnedIndex === 0)  return [[], tabs];
    if (unpinnedIndex === -1) return [tabs, []];
    return [tabs.slice(0, unpinnedIndex), tabs.slice(unpinnedIndex)];
}

/**
 * Recreate given tabs in a given window and remove given tabs.
 * @param {Object} request
 * @param {Tab[]} request.tabs
 * @param {WindowId} request.windowId
 * @param {boolean} request.keep_moved_tabs_selected
 * @returns {Promise<Tab[]>}
 */
async function reopenTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    /** @type {Tab[]} */ const protoTabs = [];
    /** @type {number[]} */ const tabIds = [];
    for (const tab of tabs) {
        const protoTab = {
            windowId,
            url: tab.url,
            title: tab.title,
            pinned: tab.pinned,
            discarded: true,
        };
        if (keep_moved_tabs_selected && tab.active)
            protoTab.active = true;
        protoTabs.push(protoTab);
        tabIds.push(tab.id);
    }
    /** @type {Tab[]} */
    const openedTabs = await Promise.all(protoTabs.map(openTab));
    browser.tabs.remove(tabIds);

    if (keep_moved_tabs_selected && tabs[0]?.highlighted)
        openedTabs.forEach(tab => !tab.active && selectTab(tab.id));

    return openedTabs;
}

/**
 * Create a tab with given properties a.k.a. a protoTab, or create a placeholder tab if protoTab.url is invalid.
 * Less strict than tabs.create(): protoTab can contain some invalid combinations, which are automatically fixed.
 * Unlike tabs.create(), undefined protoTab.active defaults to false.
 * @param {Tab} protoTab - Tab creation config object
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create}
 * @returns {Promise<Tab>}
 */
export function openTab(protoTab) {
    const { url, title, pinned } = protoTab;

    protoTab.active ??= false;

    if (protoTab.active || url.startsWith('about:'))
        delete protoTab.discarded;

    const { discarded } = protoTab;

    // Tab cannot be created both pinned and discarded - to pin later if needed
    // title only allowed if discarded
    delete protoTab[discarded ? 'pinned' : 'title'];

    if (url === 'about:newtab' || url === 'about:privatebrowsing') { // Urls tabs.create() cannot open, but unnecessary for the end result
        delete protoTab.url;
    } else if (isReader(url)) {
        protoTab.url = getReaderTarget(url);
        protoTab.openInReaderMode = true;
    }

    /** @type {Promise<Tab>} */
    const tabPromise = browser.tabs.create(protoTab).catch(() => Auto.openPlaceholder(protoTab, title));
    return (pinned && discarded) ?
        tabPromise.then(tab => pinTab(tab.id)) : tabPromise;
}

/** @returns {Promise<Tab[]>} */ export const getSelectedTabs = () => browser.tabs.query({ currentWindow: true, highlighted: true });

/** @param {TabId} tabId @returns {Promise<Tab>} */ const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
/** @param {TabId} tabId @returns {Promise<Tab>} */ const focusTab  = tabId => browser.tabs.update(tabId, { active: true }); // Deselects other tabs
/** @param {TabId} tabId @returns {Promise<Tab>} */ const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
export { focusTab };

/** @constant */ const READER_HEAD = 'about:reader?url=';
/** @param {string} url @returns {boolean}      */ const isReader = url => url.startsWith(READER_HEAD);
/** @param {string} readerURL @returns {string} */ const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length));
