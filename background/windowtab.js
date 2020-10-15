import * as Modifier from '../modifier.js';
import { windowMap } from './metadata.js';
import { SETTINGS } from './settings.js';

export const openHelp = () => openExtPage('help/help.html');
export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true });
export const switchWindow = windowId => browser.windows.update(windowId, { focused: true });

const actionMap = {
    bring:  bringTabs,
    send:   sendTabs,
    switch: switchWindow,
};

// Open extension page tab or if already open, switch to first tab found.
async function openExtPage(pathname) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    if (openedTabs.length) {
        const { id, windowId } = openedTabs[0];
        browser.tabs.reload(id);
        focusTab(id);
        switchWindow(windowId);
    } else {
        browser.tabs.create({ url: `/${pathname}` });
    }
}

export async function deselectTearOff(windowId) {
    if (SETTINGS.keep_moved_tabs_selected) return;
    const tabs = await browser.tabs.query({ windowId, active: true });
    browser.tabs.highlight({ windowId, tabs: [tabs[0].index], populate: false }); // Select focused tab to deselect other tabs
}

// Given `windowId`, select action to execute based on `action` and `modifiers`.
export async function doAction({ windowId, originWindowId, action, modifiers, tabs }) {
    const reopen = !isSamePrivateStatus(windowId, originWindowId);
    tabs ||= await getSelectedTabs();
    action = modifyAction(action, modifiers);
    actionMap[action](windowId, tabs, reopen);
}

function modifyAction(action, modifiers) {
    if (!modifiers.length) return action;
    return modifiers.includes(Modifier.BRING) ? 'bring' :
           modifiers.includes(Modifier.SEND)  ? 'send' :
           action;
}

async function bringTabs(windowId, tabs, reopen) {
    if (await sendTabs(windowId, tabs, reopen)) {
        switchWindow(windowId);
    }
}

async function sendTabs(windowId, tabs, reopen) {
    return await (reopen ? reopenTabs : moveTabs)(windowId, tabs);
}

async function moveTabs(windowId, tabs) {
    const pinnedTabIds = movablePinnedTabs(tabs)?.map(tab => tab.id);
    if (pinnedTabIds) await Promise.all(pinnedTabIds.map(unpinTab));

    const tabIds = tabs.map(tab => tab.id);
    const movedTabs = await browser.tabs.move(tabIds, { windowId, index: -1 });
    if (!movedTabs.length) return;

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);

    if (SETTINGS.keep_moved_focused_tab_focused) {
        const focusedTab = tabs.find(tab => tab.active);
        if (focusedTab) focusTab(focusedTab.id);
    }
    if (SETTINGS.keep_moved_tabs_selected) {
        tabIds.forEach(selectTab);
    }
    return movedTabs;
}

async function reopenTabs(windowId, tabs) {
    if (!movablePinnedTabs(tabs)) {
        tabs = tabs.filter(tab => !tab.pinned);
    }

    async function reopenTab(tab) {
        const url = tab.isInReaderMode ? getUrlFromReader(tab.url) : tab.url;
        const newTab = await browser.tabs.create({
            windowId,
            url,
            pinned: tab.pinned,
            active: SETTINGS.keep_moved_focused_tab_focused ? tab.active : null,
            discarded: tab.discarded,
            title: tab.discarded ? tab.title : null,
            openInReaderMode: tab.isInReaderMode,
        }).catch(() => null);
        if (newTab) browser.tabs.remove(tab.id);
        return newTab;
    }

    tabs = await Promise.all(tabs.map(reopenTab));
    tabs = tabs.filter(tab => tab);
    if (!tabs.length) return;

    if (SETTINGS.keep_moved_tabs_selected) {
        tabs.forEach(tab => { if (!tab.active) selectTab(tab.id) });
    }
    return tabs;
}

function movablePinnedTabs(tabs) {
    if (!SETTINGS.move_pinned_tabs) return;
    const pinnedTabs = tabs.filter(tab => tab.pinned);
    const pinnedTabCount = pinnedTabs.length;
    if (!pinnedTabCount) return;
    if (SETTINGS.move_pinned_tabs_if_all_pinned && tabs.length !== pinnedTabCount) return;
    return pinnedTabs;
}

const unpinTab  = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab    = tabId => browser.tabs.update(tabId, { pinned: true });
const focusTab  = tabId => browser.tabs.update(tabId, { active: true });
const selectTab = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
const isSamePrivateStatus = (windowId1, windowId2) => windowMap[windowId1].incognito === windowMap[windowId2].incognito;
const getUrlFromReader = readerUrl => decodeURIComponent(readerUrl.slice(readerUrl.indexOf('=') + 1));
