// Common actions involving windows and tabs.

import { BRING, SEND } from '../modifier.js';
import { winfoDict } from './window.js';
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

let PRESERVE_MOVED_TAB_FOCUS;

//@ state -> state
export function init() {
    PRESERVE_MOVED_TAB_FOCUS = SETTINGS.keep_moved_focused_tab_focused;
    if (!PRESERVE_MOVED_TAB_FOCUS) SETTINGS.keep_moved_tabs_selected = false;
    // Disable functions according to settings:
    if (SETTINGS.keep_moved_tabs_selected) selectFocusedTab = () => null;
}

// Open extension page tab, closing any duplicates found.
//@ (String, String), state -> state
async function openUniqueExtensionPage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    browser.tabs.remove(openedTabs.map(tab => tab.id));
    if (hash) pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
}

// Is null function via init() if SETTINGS.keep_moved_tabs_selected
//@ (Number), state -> state
export async function selectFocusedTab(windowId) {
    const tab = (await browser.tabs.query({ windowId, active: true }))[0];
    browser.tabs.highlight({ windowId, tabs: [tab.index], populate: false }); // Select focused tab to deselect other tabs
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

//@ (Number, [Object]), state -> state|null
async function bringTabs(windowId, tabs) {
    if (await sendTabs(windowId, tabs)) switchWindow(windowId);
}

//@ (Number, [Object]), state -> (Promise: [Object]|null), state|null
function sendTabs(windowId, tabs) {
    const originWindowId = tabs[0].windowId;
    const reopen = !isSamePrivateStatus(originWindowId, windowId);
    return (reopen ? reopenTabs : moveTabs)(windowId, tabs);
}

//@ (Number, [Object]), state -> (Promise: [Object]|null), state|null
async function moveTabs(windowId, tabs) {
    const pinnedTabIds = getPinnedTabs(tabs)?.map(tab => tab.id);
    if (pinnedTabIds) await Promise.all(pinnedTabIds.map(unpinTab)); // Unpin pinned tabs so they can be moved

    const tabIds = tabs.map(tab => tab.id);
    const movedTabs = await browser.tabs.move(tabIds, { windowId, index: -1 }); // Ignores pinned tabs

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab); // Repin originally-pinned tabs
    if (!movedTabs.length) return;

    if (PRESERVE_MOVED_TAB_FOCUS) {
        const preMoveFocusedTab = tabs.find(tab => tab.active);
        if (preMoveFocusedTab) focusTab(preMoveFocusedTab.id);
        if (SETTINGS.keep_moved_tabs_selected) movedTabs.forEach(tab => selectTab(tab.id));
    }
    return movedTabs;
}

//@ ([Object]) -> ([Object]|null)
function getPinnedTabs(tabs) {
    const unpinnedIndex = tabs.findIndex(tab => !tab.pinned);
    if (unpinnedIndex === 0) return;
    if (unpinnedIndex === -1) return tabs;
    return tabs.slice(0, unpinnedIndex);
}

// Recreate given tabs in a given window, maintaining pinned states.
//@ (Number, [Object]), state -> ([Object]), state | (null)
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
        if (tab.active && PRESERVE_MOVED_TAB_FOCUS)
            protoTab.active = true;
        protoTabs.push(protoTab);
        tabIds.push(tab.id);
    }
    const openedTabs = await Promise.all(protoTabs.map(openTab));
    browser.tabs.remove(tabIds);

    if (SETTINGS.keep_moved_tabs_selected)
        openedTabs.forEach(tab => selectTab(tab.id));

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
const unpinTab  = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true });
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });

const isSamePrivateStatus = (windowId1, windowId2) => winfoDict[windowId1].incognito === winfoDict[windowId2].incognito; //@ (Number, Number), state -> (Boolean)

const READER_HEAD = 'about:reader?url=';
const isReader = url => url.startsWith(READER_HEAD); //@ (String) -> (Boolean)
const getReaderTarget = readerURL => decodeURIComponent(readerURL.slice(READER_HEAD.length)); //@ (String) -> (String)

const PLACEHOLDER_PATH = browser.runtime.getURL('../placeholder/tab.html');
const buildPlaceholderURL = (url, title) => `${PLACEHOLDER_PATH}?${new URLSearchParams({ url, title })}`; //@ (String, String) -> (String)
const isPlaceholder = url => url.startsWith(PLACEHOLDER_PATH); //@ (String) -> (Boolean)
const getPlaceholderTarget = placeholderUrl => (new URL(placeholderUrl)).searchParams.get('url'); //@ (String) -> (String)
export const deplaceholderize = url => isPlaceholder(url) ? getPlaceholderTarget(url) : url; //@ (String) -> (String)
