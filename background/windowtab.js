import { OPTIONS } from './options.js';
import { windows as metaWindows } from './metadata.js';

export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true });
const unpinTab    = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab      = tabId => browser.tabs.update(tabId, { pinned: true });
const activateTab = tabId => browser.tabs.update(tabId, { active: true });
const selectTab   = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
const getUrlFromReader = readerUrl => decodeURIComponent(readerUrl.slice(readerUrl.indexOf('=') + 1));

export const switchToWindow = windowId => browser.windows.update(windowId, { focused: true });
const actionFunctions = { bringTabs, sendTabs, switchToWindow };

// Select actionFunction to execute based on `action` and optionally `reopen` and `modifiers`, given `windowId`.
// If `tabs` not given, currently selected tabs will be used.
export async function doAction({ action, windowId, reopen, tabs, modifiers }) {
    tabs = tabs || await getSelectedTabs();
    action = modifyAction(action, modifiers);
    actionFunctions[action](windowId, tabs, reopen);
}

function modifyAction(action, modifiers) {
    return modifiers.includes(OPTIONS.bring_modifier) ? 'bringTabs' :
           modifiers.includes(OPTIONS.send_modifier)  ? 'sendTabs' :
           action;
}

function bringTabs(windowId, tabs, reopen) {
    switchToWindow(windowId);
    sendTabs(windowId, tabs, reopen);
}

function sendTabs(windowId, tabs, reopen) {
    const tabAction = reopen ? reopenTabs : moveTabs;
    tabAction(windowId, tabs);
}

async function moveTabs(windowId, tabs) {
    let pinnedTabIds;
    if (OPTIONS.move_pinned_tabs) {
        pinnedTabIds = tabs.filter(tab => tab.pinned).map(tab => tab.id);
        await Promise.all(pinnedTabIds.map(unpinTab));
    }

    const tabIds = tabs.map(tab => tab.id);
    await browser.tabs.move(tabIds, { windowId, index: -1 });

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);

    if (OPTIONS.keep_moved_active_tab_active) {
        const activeTabObject = tabs.find(tab => tab.active);
        if (activeTabObject) activateTab(activeTabObject.id);
    }
    if (OPTIONS.keep_moved_tabs_selected) {
        tabIds.forEach(selectTab);
    }
}

async function reopenTabs(windowId, tabs) {
    if (!OPTIONS.move_pinned_tabs) {
        tabs = tabs.filter(tab => !tab.pinned);
    }

    async function reopenTab(tab) {
        const url = tab.isInReaderMode ? getUrlFromReader(tab.url) : tab.url;
        const newTab = await browser.tabs.create({
            windowId,
            url,
            pinned: tab.pinned,
            active: OPTIONS.keep_moved_active_tab_active ? tab.active : null,
            discarded: tab.discarded,
            title: tab.discarded ? tab.title : null,
            openInReaderMode: tab.isInReaderMode,
        }).catch(() => null);
        if (newTab) browser.tabs.remove(tab.id);
        return newTab;
    }
    tabs = await Promise.all(tabs.map(reopenTab));

    if (OPTIONS.keep_moved_tabs_selected) {
        tabs.forEach(tab => { if (tab && !tab.active) selectTab(tab.id) });
    }
}

export function samePrivateStatus(windowIdOrObject1, windowIdOrObject2) {
    const isPrivate = x => isNaN(x) ? x.incognito : metaWindows[x].incognito;
    return isPrivate(windowIdOrObject1) == isPrivate(windowIdOrObject2);
}
