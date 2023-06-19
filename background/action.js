// Common actions involving windows and tabs.

import { BRING, SEND } from '../modifier.js';
import * as Settings from '../settings.js';
import * as Name from '../name.js';
import * as Chrome from './chrome.js';

export const openHelp = hash => openUniqueExtensionPage('help/help.html', hash); //@ (String) -> state
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

// Open extension page tab, closing any duplicates found.
//@ (String, String), state -> state
async function openUniqueExtensionPage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    if (hash)
        pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
    browser.tabs.remove(openedTabs.map(tab => tab.id));
}

// Select action to execute based on content of request.
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
    if (modifiedActionDict) {
        for (const modifier in modifiedActionDict)
            if (modifiers.includes(modifier))
                return modifiedActionDict[modifier];
    }
    return action;
}

// Create a new window. If isMove=true, do so with currently selected tabs. If focused=false, minimize the window.
// Note: A new minimized window will briefly have focus. Firefox ignores windows.create/update({ focused: false }).
//@ ({ String, Boolean, Boolean, Boolean }), state -> (Object), state
export async function createWindow({ name, isMove, focused = true, incognito }) {
    const [currentWindow, newWindow] = await Promise.all([
        browser.windows.getLastFocused(),
        browser.windows.create({ incognito, state: focused ? null : 'minimized' }),
    ]);
    const currentWindowDetail = { windowId: currentWindow.id };
    const newWindowId = newWindow.id;

    if (name) {
        Name.save(newWindowId, name);
        Chrome.update(newWindowId, name);
    }

    if (isMove) {
        const allTabs = await browser.tabs.query(currentWindowDetail); // Get all tabs first for checking if all selected
        const selectedTabs = allTabs.filter(tab => tab.highlighted);

        // If all of the origin window's tabs are to be moved, add a tab to prevent the window from closing
        if (selectedTabs.length === allTabs.length)
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
    const [keep_moved_tabs_selected, tabs] = await Promise.all([
        Settings.get('keep_moved_tabs_selected'),
        request.tabs ?? getSelectedTabs(),
    ]);
    request.tabs ??= tabs;
    request.keep_moved_tabs_selected = keep_moved_tabs_selected;

    const movedTabs = await moveTabs(request);
    return movedTabs.length ?
        movedTabs : reopenTabs(request);
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

    if (url === 'about:newtab') {
        delete protoTab.url;
    } else if (isReader(url)) {
        protoTab.url = getReaderTarget(url);
        protoTab.openInReaderMode = true;
    }

    const tabPromise = browser.tabs.create(protoTab).catch(() => openPlaceholderTab(protoTab, title));
    return (pinned && discarded) ?
        tabPromise.then(tab => pinTab(tab.id)) : tabPromise;
}

//@ (Object, String) -> (Promise: Object), state
function openPlaceholderTab(protoTab, title) {
    const url = protoTab.url;
    protoTab.url = buildPlaceholderURL(url, title || url);
    return browser.tabs.create(protoTab);
}

const getSelectedTabs = () => browser.tabs.query({ currentWindow: true, highlighted: true }); //@ state -> (Promise: [Object])

//@ (Number) -> (Promise: Object), state
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true }); // Deselects other tabs
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
export { focusTab };

const READER_HEAD = 'about:reader?url=';
const isReader = url => url.startsWith(READER_HEAD); //@ (String) -> (Boolean)
const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length)); //@ (String) -> (String)

const PLACEHOLDER_PATH = '../placeholder/tab.html';
const buildPlaceholderURL = (url, title) => `${PLACEHOLDER_PATH}?${new URLSearchParams({ url, title })}`; //@ (String, String) -> (String)
const isPlaceholder = url => url.startsWith(browser.runtime.getURL(PLACEHOLDER_PATH)); //@ (String) -> (Boolean)
const getPlaceholderTarget = placeholderUrl => (new URL(placeholderUrl)).searchParams.get('url'); //@ (String) -> (String)
export const deplaceholderize = url => isPlaceholder(url) ? getPlaceholderTarget(url) : url; //@ (String) -> (String)
