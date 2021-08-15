// Common actions involving windows and tabs.

import { BRING, SEND } from '../modifier.js';
import { winfoDict } from './window.js';
import { SETTINGS } from './settings.js';

export const openHelp = hash => openUniqueExtensionPage('help/help.html', hash);
export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true });
export const switchWindow = windowId => browser.windows.update(windowId, { focused: true });

const actionDict = {
    bring:  bringTabs,
    send:   sendTabs,
    switch: switchWindow,
};

export function init() {
    if (!SETTINGS.keep_moved_focused_tab_focused) SETTINGS.keep_moved_tabs_selected = false;
    // Disable functions according to settings:
    if (SETTINGS.keep_moved_tabs_selected) selectFocusedTab = () => null;
    if (!SETTINGS.move_pinned_tabs) movablePinnedTabs = () => null;
}

// Open extension page tab, closing any duplicates found.
async function openUniqueExtensionPage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    browser.tabs.remove(openedTabs.map(tab => tab.id));
    if (hash) pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
}

export async function selectFocusedTab(windowId) {
    const tab = (await browser.tabs.query({ windowId, active: true }))[0];
    browser.tabs.highlight({ windowId, tabs: [tab.index], populate: false }); // Select focused tab to deselect other tabs
}

// Select action to execute based on `action` and `modifiers`.
export async function execute({ action, modifiers, windowId, tabs }) {
    tabs = tabs || await getSelectedTabs();
    action = modify(action, modifiers);
    actionDict[action](windowId, tabs);
}

function modify(action, modifiers) {
    if (!modifiers.length) return action;
    return modifiers.includes(BRING) ? 'bring' :
           modifiers.includes(SEND)  ? 'send' :
           action;
}

// Create a new window containing currently selected tabs.
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

async function bringTabs(windowId, tabs) {
    if (await sendTabs(windowId, tabs)) switchWindow(windowId);
}

async function sendTabs(windowId, tabs) {
    const originWindowId = tabs[0].windowId;
    const reopen = !isSamePrivateStatus(originWindowId, windowId);
    return await (reopen ? reopenTabs : moveTabs)(windowId, tabs);
}

async function moveTabs(windowId, tabs) {
    const pinnedTabIds = movablePinnedTabs(tabs)?.map(tab => tab.id);
    if (pinnedTabIds) await Promise.all(pinnedTabIds.map(unpinTab));

    const tabIds = tabs.map(tab => tab.id);
    const movedTabs = await browser.tabs.move(tabIds, { windowId, index: -1 });

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);
    if (!movedTabs.length) return;

    if (SETTINGS.keep_moved_focused_tab_focused) {
        const preMoveFocusedTab = tabs.find(tab => tab.active);
        if (preMoveFocusedTab) focusTab(preMoveFocusedTab.id);
        if (SETTINGS.keep_moved_tabs_selected) movedTabs.forEach(tab => selectTab(tab.id));
    }
    return movedTabs;
}

async function reopenTabs(windowId, tabs) {
    if (!movablePinnedTabs(tabs)) tabs = tabs.filter(tab => !tab.pinned);

    const focusedTabSetting = SETTINGS.keep_moved_focused_tab_focused;
    const reopenTab = tab => {
        const { url, title, pinned, discarded } = tab;
        const properties = { url, title, pinned, discarded, windowId };
        if (tab.active && focusedTabSetting) properties.active = true;
        browser.tabs.remove(tab.id);
        return openTab(properties);
    };
    for (const tab of tabs) await reopenTab(tab);

    const tabCount = tabs.length;
    if (!tabCount) return;

    if (SETTINGS.keep_moved_tabs_selected && tabCount > 1) {
        for (const { id } of tabs) selectTab(id);
    }
    return tabs;
}

function movablePinnedTabs(tabs) {
    const pinnedTabs = tabs.filter(tab => tab.pinned);
    const pinnedTabCount = pinnedTabs.length;
    if (!pinnedTabCount) return;
    if (SETTINGS.move_pinned_tabs_if_all_pinned && tabs.length !== pinnedTabCount) return;
    return pinnedTabs;
}

// Create a tab with given properties, or a placeholder tab if properties.url is invalid.
// Less strict than tabs.create(): properties can contain some invalid combinations, which are automatically fixed.
export function openTab(properties) {
    const { url, title } = properties;

    if (properties.active || url.startsWith('about:')) delete properties.discarded;
    if (!properties.discarded) delete properties.title;

    if (url === 'about:newtab') delete properties.url;
    else
    if (isReader(url)) {
        properties.url = getReaderTarget(url);
        properties.openInReaderMode = true;
    }

    return browser.tabs.create(properties).catch(() => openPlaceholderTab(properties, title));
}

function openPlaceholderTab(properties, title) {
    properties.url = buildPlaceholderURL(properties.url, title);
    return browser.tabs.create(properties);
}


const unpinTab  = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true });
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
const isSamePrivateStatus = (windowId1, windowId2) => winfoDict[windowId1].incognito === winfoDict[windowId2].incognito;

const READER_HEAD = 'about:reader?url=';
const isReader = url => url.startsWith(READER_HEAD);
const getReaderTarget = readerURL => decodeURIComponent( readerURL.slice(READER_HEAD.length) );

const PLACEHOLDER_PATH = browser.runtime.getURL('../placeholder/tab.html');
const buildPlaceholderURL = (url, title) => `${PLACEHOLDER_PATH}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
const isPlaceholder = url => url.startsWith(PLACEHOLDER_PATH);
const getPlaceholderTarget = placeholderUrl => decodeURIComponent( (new URL(placeholderUrl)).searchParams.get('url') );
export const deplaceholderize = url => isPlaceholder(url) ? getPlaceholderTarget(url) : url;
