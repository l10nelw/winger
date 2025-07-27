// User actions involving windows and tabs.

import * as Auto from './action.auto.js';
import { GroupIdTabIdMap } from './action.group.js';
import * as Chrome from './chrome.js';

import * as Name from '../name.js';
import * as Storage from '../storage.js';

/** @import { ActionRequest, GroupId, ProtoTab, Tab, TabId, Window } from '../types.js' */

/**
 * @param {string} hash
 * @returns {Promise<Tab>}
 */
export const openHelp = hash => Auto.openUniquePage('page/help.html', hash);

/**
 * @param {ActionRequest}
 * @returns {Promise<Window>}
 */
export const switchWindow = ({ windowId }) => browser.windows.update(windowId, { focused: true });

/**
 * @type {Object<string, (request: ActionRequest) => Promise<Window | Tab[] | void>>}
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
 * @param {ActionRequest} request
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
    const state = (kick && minimize_kick_window) ? 'minimized' : undefined;
    /** @type {Window} */ const newWindow = await browser.windows.create({ incognito, state });
    const newWindowId = newWindow.id;

    if (name) {
        Name.save(newWindowId, name);
        Chrome.update([[newWindowId, name]]);
    }

    // Firefox ignores `windows.create/update({ focused: false })`
    // So if `focused=false` (i.e. kicked) and `minimize_kick_window=false`, switch back to current window
    if (kick && !minimize_kick_window)
        switchWindow(currentWindowInfo);

    if (isMove) {
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
 * @param {ActionRequest} request
 */
async function bringTabs(request) {
    await sendTabs(request) && switchWindow(request);
}

/**
 * Attempt `moveTabs`; if unsuccessful (e.g. windows are of different private statuses) then `reopenTabs`.
 * @param {ActionRequest} request
 * @returns {Promise<Tab[]>}
 */
async function sendTabs(request) {
    const [tabs, [keep_moved_tabs_selected, discard_minimized_window]] = await Promise.all([
        request.tabs ?? getSelectedTabs(), // If tabs not given in request, get selected tabs
        Storage.getValues(['keep_moved_tabs_selected', 'discard_minimized_window']),
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
 * @param {ActionRequest} request
 * @returns {Promise<Tab[]>}
 */
async function moveTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    const [pinnedTabs, unpinnedTabs] = splitTabsByPinnedState(tabs);

    // Get destination index for pinned tabs, since they cannot be moved to index -1 if unpinned tabs exist at destination
    const index = pinnedTabs.length ?
        (await browser.tabs.query({ windowId, pinned: true })).length : 0;

    // Take note of groups to be "moved", if all of its tabs are participating in the move
    const groupIdTabIdMap = new GroupIdTabIdMap();
    groupIdTabIdMap.addTabsIfGroup(tabs);
    await groupIdTabIdMap.deletePartialGroupEntries();
    const groups = await groupIdTabIdMap.getGroups();

    /** @type {Tab[]} */
    const movedTabs = (await Promise.all([
        browser.tabs.move(pinnedTabs.map(tab => tab.id), { windowId, index }),
        browser.tabs.move(unpinnedTabs.map(tab => tab.id), { windowId, index: -1 }),
    ])).flat();

    if (!movedTabs.length)
        return [];

    // Recreate groups at destination
    // Much simpler and faster than an implementation that uses `tabGroups.move()`
    groupIdTabIdMap.recreateGroups(groups, windowId);

    if (keep_moved_tabs_selected && tabs[0]?.highlighted) {
        const preMoveFocusedTab = tabs.find(tab => tab.active);
        if (preMoveFocusedTab)
            focusTab(preMoveFocusedTab.id);
        movedTabs.forEach(tab => !tab.active && selectTab(tab.id));
    }

    // Note: Array contents not updated since its creation
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
 * @param {ActionRequest} request
 * @returns {Promise<Tab[]>}
 */
async function reopenTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    const groupIdTabIdMap = new GroupIdTabIdMap();
    /** @type {(ProtoTab & { groupId: GroupId })[]} */ const protoTabs = [];
    /** @type {TabId[]} */ const oldTabIds = [];

    for (const { active, groupId, id, pinned, title, url } of tabs) {
        const protoTab = {
            windowId, discarded: true,
            pinned, title, url,
        };
        if (keep_moved_tabs_selected && active)
            protoTab.active = true;
        if (groupId !== -1) {
            protoTab.groupId = groupId;
            groupIdTabIdMap.group(groupId, id);
        }
        protoTabs.push(protoTab);
        oldTabIds.push(id);
    }

    await groupIdTabIdMap.deletePartialGroupEntries();
    const groups = await groupIdTabIdMap.getGroups();
    groupIdTabIdMap.clear(); // Done with old tabs; will reuse for new tabs

    const newTabs = await Promise.all(protoTabs.map(
        async protoTab => {
            const newTab = await openTab(protoTab);
            if (protoTab.groupId)
                groupIdTabIdMap.group(protoTab.groupId, newTab.id);
            return newTab;
        }
    ));

    groupIdTabIdMap.recreateGroups(groups, windowId);

    if (keep_moved_tabs_selected && tabs[0]?.highlighted)
        newTabs.forEach(newTab => !newTab.active && selectTab(newTab.id));

    browser.tabs.remove(oldTabIds);

    // Note: Array contents not updated since its creation
    return newTabs;
}

/**
 * Given `protoTab`, create a tab, or a placeholder tab if tab creation fails.
 * Less strict than `browser.tabs.create()`: `protoTab` can contain invalid properties and property combinations, which are automatically fixed.
 * Unlike `browser.tabs.create()`, undefined `protoTab.active` defaults to `false`.
 * @see ProtoTab
 * @param {ProtoTab} protoTab
 * @returns {Promise<Tab>}
 */
export function openTab(protoTab) {
    protoTab = scrubbedProtoTab(protoTab); // Create valid protoTab while keeping original intact

    const { pinned, title, url } = protoTab;

    protoTab.active ??= false;

    if (protoTab.active || url.startsWith('about:'))
        delete protoTab.discarded;
    const { discarded } = protoTab;
    discarded
        ? delete protoTab.pinned // Tab cannot be created both pinned and discarded - pin later if expected
        : delete protoTab.title; // Can only set title if discarded

    if (url === 'about:newtab' || url === 'about:privatebrowsing') { // Urls `browser.tabs.create()` cannot open explicitly; they are opened via absent url
        delete protoTab.url;
    } else if (isReader(url)) {
        protoTab.url = getReaderTarget(url);
        protoTab.openInReaderMode = true;
    }

    /** @type {Promise<Tab>} */
    const tabPromise = browser.tabs.create(protoTab).catch(() => Auto.openPlaceholder(protoTab, title));
    return (pinned && discarded) ? // Pin discarded tab now if expected
        tabPromise.then(tab => pinTab(tab.id)) : tabPromise;
}

/**
 * Recreate protoTab with only valid properties.
 * @param {ProtoTab} protoTab
 * @returns {ProtoTab}
 */
function scrubbedProtoTab(protoTab) {
    const safeProtoTab = {};
    for (const key of VALID_PROTOTAB_PROPS)
        if (key in protoTab)
            safeProtoTab[key] = protoTab[key];
    return safeProtoTab;
}

const VALID_PROTOTAB_PROPS =
    ['active', 'cookieStoreId', 'discarded', 'index', 'muted', 'openerTabId', 'openInReaderMode', 'pinned', 'title', 'url', 'windowId'];

/** @returns {Promise<Tab[]>} */ export const getSelectedTabs = () => browser.tabs.query({ currentWindow: true, highlighted: true });

/** @param {TabId} tabId @returns {Promise<Tab>} */ const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
/** @param {TabId} tabId @returns {Promise<Tab>} */ const focusTab  = tabId => browser.tabs.update(tabId, { active: true }); // Deselects other tabs
/** @param {TabId} tabId @returns {Promise<Tab>} */ const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
export { focusTab };

const READER_HEAD = 'about:reader?url=';
/** @param {string} url @returns {boolean}      */ const isReader = url => url.startsWith(READER_HEAD);
/** @param {string} readerURL @returns {string} */ const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length));
