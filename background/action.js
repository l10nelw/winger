// User actions involving windows and tabs.

import { BRING, SEND } from '../modifier.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';
import * as Chrome from './chrome.js';
import * as Auto from './action.auto.js';

export const openHelp = hash => Auto.openUniquePage('page/help.html', hash); //@ (String) -> state
export const switchWindow = ({ windowId }) => browser.windows.update(windowId, { focused: true }); //@ ({ Number }), state -> (Promise: Object), state

const ACTION_DICT = {
    bring:       bringTabs,
    send:        sendTabs,
    switch:      switchWindow,
    new:         ({ argument: name }) => createWindow({ name }),
    newprivate:  ({ argument: name }) => createWindow({ name, incognito: true }),
    pop:         ({ argument: name }) => createWindow({ name, isMove: true }),
    popprivate:  ({ argument: name }) => createWindow({ name, isMove: true, incognito: true }),
    kick:        ({ argument: name }) => createWindow({ name, isMove: true, focused: false }),
    kickprivate: ({ argument: name }) => createWindow({ name, isMove: true, focused: false, incognito: true }),
};

const MODIFIABLE_ACTIONS_TABLE = {
    switch:      { [BRING]: 'bring',      [SEND]: 'send' },
    new:         { [BRING]: 'pop',        [SEND]: 'kick' },
    newprivate:  { [BRING]: 'popprivate', [SEND]: 'kickprivate' },
    bring:       { [SEND]: 'send' },
    pop:         { [SEND]: 'kick' },
    popprivate:  { [SEND]: 'kickprivate' },
    send:        { [BRING]: 'bring' },
    kick:        { [BRING]: 'pop' },
    kickprivate: { [BRING]: 'popprivate' },
}

// Select action to execute based on content of action request.
// A request contains: { type: 'action', action, argument, modifiers, windowId }
//@ (Object), state -> state
export async function execute(request) {
    request.action = modify(request.action, request.modifiers);
    ACTION_DICT[request.action](request);
}

// Change an action to another based on any modifiers given.
//@ (String, [String]) -> (String)
function modify(action, modifiers) {
    if (!modifiers.length)
        return action;
    const modifiedActionDict = MODIFIABLE_ACTIONS_TABLE[action];
    if (!modifiedActionDict)
        return action;
    for (const modifier in modifiedActionDict)
        if (modifiers.includes(modifier))
            return modifiedActionDict[modifier];
    return action;
}

// Create a new window. If isMove=true, do so with currently selected tabs. If focused=false, minimize the window.
//@ ({ String, Boolean, Boolean, Boolean }), state -> (Object), state
export async function createWindow({ name, isMove, focused = true, incognito }) {
    const [minimize_kick_window, currentWindow] = await Promise.all([
        Storage.getValue('minimize_kick_window'),
        browser.windows.getLastFocused({ populate: isMove }),
    ]);
    const currentWindowDetail = { windowId: currentWindow.id };

    const kick = !focused;
    const state = (kick && minimize_kick_window) ? 'minimized' : null;
    const newWindow = await browser.windows.create({ incognito, state });
    const newWindowId = newWindow.id;

    if (name) {
        Name.save(newWindowId, name);
        Chrome.update([[newWindowId, name]]);
    }

    // Firefox ignores windows.create/update({ focused: false }), so if focused=false, switch back to current window
    if (kick && !minimize_kick_window)
        switchWindow(currentWindowDetail);

    if (isMove) {
        const selectedTabs = currentWindow.tabs.filter(tab => tab.highlighted);

        // If all of the origin window's tabs are to be moved, add a tab to prevent the window from closing
        if (selectedTabs.length === currentWindow.tabs.length)
            await browser.tabs.create(currentWindowDetail);

        await sendTabs({ tabs: selectedTabs, windowId: newWindowId });
        browser.tabs.remove(newWindow.tabs[0].id);
    }

    return newWindow;
}

//@ (Object), state -> state|nil
async function bringTabs(request) {
    await sendTabs(request) && switchWindow(request);
}

// Attempt moveTabs; if unsuccessful (e.g. windows are of different private statuses) then reopenTabs.
//@ (Object), state -> ([Object]), state | (undefined)
async function sendTabs(request) {
    const [tabs, [keep_moved_tabs_selected, unload_minimized_window]] = await Promise.all([
        request.tabs ?? getSelectedTabs(),
        Storage.getValue(['keep_moved_tabs_selected', 'unload_minimized_window']),
    ]);
    request.tabs ??= tabs;
    request.keep_moved_tabs_selected = keep_moved_tabs_selected;

    const movedTabs = await moveTabs(request);
    if (movedTabs.length) {
        Auto.restoreTabRelations(movedTabs, tabs, true);
        if (unload_minimized_window && request.minimized && request.action !== 'bring')
            Auto.discardWindow.schedule(request.windowId);
        return movedTabs;
    }
    // Move failed so reopen instead
    const reopenedTabs = await reopenTabs(request);
    Auto.restoreTabRelations(reopenedTabs, tabs);
    return reopenedTabs;
}

//@ ({ [Object], Number, Boolean }), state -> ([Object]), state | (undefined)
async function moveTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    const [pinnedTabs, unpinnedTabs] = splitTabsByPinnedState(tabs);

    // Get destination index for pinned tabs, as they cannot be moved to index -1 where unpinned tabs exist
    const index = pinnedTabs.length ?
        (await browser.tabs.query({ windowId, pinned: true })).length : 0;

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

//@ ([Object]) -> ([[Object], [Object]])
function splitTabsByPinnedState(tabs) {
    const unpinnedIndex = tabs.findIndex(tab => !tab.pinned);
    if (unpinnedIndex === 0)  return [[], tabs];
    if (unpinnedIndex === -1) return [tabs, []];
    return [tabs.slice(0, unpinnedIndex), tabs.slice(unpinnedIndex)];
}

// Recreate given tabs in a given window and remove original tabs.
//@ ({ [Object], Number, Boolean }) -> ([Object]), state | (undefined)
async function reopenTabs({ tabs, windowId, keep_moved_tabs_selected }) {
    const protoTabs = [];
    const tabIds = [];
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
    const openedTabs = await Promise.all(protoTabs.map(openTab));
    browser.tabs.remove(tabIds);

    if (keep_moved_tabs_selected && tabs[0]?.highlighted)
        openedTabs.forEach(tab => !tab.active && selectTab(tab.id));

    return openedTabs;
}

// Create a tab with given properties a.k.a. a protoTab, or create a placeholder tab if protoTab.url is invalid.
// Less strict than tabs.create(): protoTab can contain some invalid combinations, which are automatically fixed.
// Unlike tabs.create(), undefined protoTab.active defaults to false.
//@ (Object), state -> (Promise: Object), state
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

    const tabPromise = browser.tabs.create(protoTab).catch(() => Auto.openPlaceholder(protoTab, title));
    return (pinned && discarded) ?
        tabPromise.then(tab => pinTab(tab.id)) : tabPromise;
}

export const getSelectedTabs = () => browser.tabs.query({ currentWindow: true, highlighted: true }); //@ state -> (Promise: [Object])

//@ (Number) -> (Promise: Object), state
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true }); // Deselects other tabs
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
export { focusTab };

const READER_HEAD = 'about:reader?url=';
const isReader = url => url.startsWith(READER_HEAD); //@ (String) -> (Boolean)
const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length)); //@ (String) -> (String)
