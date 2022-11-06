// Common actions involving windows and tabs.

import { BRING, SEND } from '../modifier.js';
import { SETTINGS } from './settings.js';

export const openHelp = hash => openUniqueExtensionPage('help/help.html', hash); //@ (String) -> state
export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true }); //@ state -> ([Object])
export const switchWindow = windowId => browser.windows.update(windowId, { focused: true }); //@ (Number), state -> (Promise: Object), state

// fn(windowId) or fn(windowId, tabs)
const actionDict = {
    bring:  bringTabs,
    send:   sendTabs,
    switch: switchWindow,
};

// Open extension page tab, closing any duplicates found.
//@ (String, String), state -> state
async function openUniqueExtensionPage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    browser.tabs.remove(openedTabs.map(tab => tab.id));
    if (hash) pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
}

// Select action to execute based on `action` and `modifiers`.
//@ ({ String, [String], Number, [Object] }), state -> state
export async function execute({ action, modifiers, windowId, tabs }) {
    tabs ??= await getSelectedTabs();
    action = modify(action, modifiers);
    actionDict[action](windowId, tabs);
}

//@ (String, [String]) -> (String)
function modify(action, modifiers) {
    if (!modifiers.length) return action;
    return modifiers.includes(BRING) ? 'bring' :
           modifiers.includes(SEND)  ? 'send' :
           action;
}

// Create a new window containing currently selected tabs.
//@ (Boolean), state -> state
export async function pop(incognito) {
    const [tabs, window] = await Promise.all([
        browser.tabs.query({ currentWindow: true }),
        browser.windows.create({ incognito, focused: false }),
    ]);
    const selectedTabs = tabs.filter(tab => tab.highlighted);
    if (selectedTabs.length === tabs.length) {
        await browser.tabs.create({ windowId: tabs[0].windowId }); // Prevents origin window from closing
    }
    const windowId = window.id;
    const initTabId = window.tabs[0].id;
    await bringTabs(windowId, selectedTabs);
    browser.tabs.remove(initTabId);
}

//@ (Number, [Object]), state -> state|nil
async function bringTabs(windowId, tabs) {
    if (await sendTabs(windowId, tabs)) switchWindow(windowId);
}

// Attempt moveTabs; if unsuccessful (e.g. windows are of different private statuses) then reopenTabs.
//@ (Number, [Object]), state -> ([Object]), state | (undefined)
async function sendTabs(windowId, tabs) {
    const movedTabs = await moveTabs(windowId, tabs);
    return movedTabs.length ?
        movedTabs : reopenTabs(windowId, tabs);
}

//@ (Number, [Object]), state -> ([Object]), state | (undefined)
async function moveTabs(windowId, tabs) {
    const [pinnedTabs, unpinnedTabs] = splitTabsByPinnedState(tabs);
    // Get destination index for pinned tabs, as they cannot be moved to index -1 where unpinned tabs exist
    const index = pinnedTabs.length ?
        (await browser.tabs.query({ windowId, pinned: true })).length : 0;
    const movedTabs = (await Promise.all([
        browser.tabs.move(pinnedTabs.map(tab => tab.id), { windowId, index }),
        browser.tabs.move(unpinnedTabs.map(tab => tab.id), { windowId, index: -1 }),
    ])).flat();

    if (SETTINGS.keep_moved_tabs_selected && tabs[0]?.highlighted) {
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

// Recreate given tabs in a given window, maintaining pinned states.
//@ (Number, [Object]), state -> ([Object]), state | (undefined)
async function reopenTabs(windowId, tabs) {
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
        if (tab.active && SETTINGS.keep_moved_tabs_selected)
            protoTab.active = true;
        protoTabs.push(protoTab);
        tabIds.push(tab.id);
    }
    const openedTabs = await Promise.all(protoTabs.map(openTab));
    browser.tabs.remove(tabIds);

    if (SETTINGS.keep_moved_tabs_selected && tabs[0]?.highlighted)
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

    // Tab cannot be created both pinned and discarded
    // title only allowed if discarded
    delete protoTab[discarded ? 'pinned' : 'title'];

    if (url === 'about:newtab')
        delete protoTab.url;
    else
    if (isReader(url)) {
        protoTab.url = getReaderTarget(url);
        protoTab.openInReaderMode = true;
    }

    const tabPromise = browser.tabs.create(protoTab).catch(() => openPlaceholderTab(protoTab, title));
    return (pinned && discarded) ? tabPromise.then(tab => pinTab(tab.id)) : tabPromise;
}

//@ (Object, String) -> (Promise: Object), state
function openPlaceholderTab(protoTab, title) {
    protoTab.url = buildPlaceholderURL(protoTab.url, title);
    return browser.tabs.create(protoTab);
}

//@ (Number) -> (Promise: Object), state
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true }); // Deselects other tabs
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
export { focusTab };

const READER_HEAD = 'about:reader?url=';
const isReader = url => url.startsWith(READER_HEAD); //@ (String) -> (Boolean)
const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length)); //@ (String) -> (String)

const PLACEHOLDER_PATH = browser.runtime.getURL('../placeholder/tab.html');
const buildPlaceholderURL = (url, title) => `${PLACEHOLDER_PATH}?${new URLSearchParams({ url, title })}`; //@ (String, String) -> (String)
const isPlaceholder = url => url.startsWith(PLACEHOLDER_PATH); //@ (String) -> (Boolean)
const getPlaceholderTarget = placeholderUrl => (new URL(placeholderUrl)).searchParams.get('url'); //@ (String) -> (String)
export const deplaceholderize = url => isPlaceholder(url) ? getPlaceholderTarget(url) : url; //@ (String) -> (String)
