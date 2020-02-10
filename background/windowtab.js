import { OPTIONS } from './options.js';
import { windows as metaWindows } from './metadata.js';

const unpinTab    = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab      = tabId => browser.tabs.update(tabId, { pinned: true });
const activateTab = tabId => browser.tabs.update(tabId, { active: true });
const selectTab   = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
const getUrlFromReader = readerUrl => decodeURIComponent(readerUrl.slice(readerUrl.indexOf('=') + 1));
export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true });
export const focusWindow = windowId => browser.windows.update(windowId, { focused: true });

// Select the end-goal action based on various inputs, given the target windowId.
// Relevant modifiers may override given doBringTabs/doSendTabs booleans.
// If tabObjects not given, moveTabs() will find currently selected tabs.
export async function goalAction(windowId, modifiers, doBringTabs, doSendTabs, tabObjects) {
    const bringModifierOn = modifiers.includes(OPTIONS.bring_modifier);
    const sendModifierOn = modifiers.includes(OPTIONS.send_modifier);
    if (bringModifierOn || doBringTabs && !sendModifierOn) {
        bringTabs(windowId, tabObjects);
    } else if (sendModifierOn || doSendTabs) {
        sendTabs(windowId, tabObjects);
    } else {
        focusWindow(windowId);
    }
}

export async function bringTabs(windowId, tabObjects) {
    tabObjects = tabObjects || await getSelectedTabs();
    focusWindow(windowId);
    sendTabs(windowId, tabObjects);
}

export async function sendTabs(windowId, tabObjects) {
    tabObjects = tabObjects || await getSelectedTabs();
    // If either origin or destination window is private, reopen instead of move tabs.
    const action = samePrivateStatus(windowId, tabObjects[0]) ? moveTabs : reopenTabs;
    action(windowId, tabObjects);
}

function samePrivateStatus(windowIdOrObject1, windowIdOrObject2) {
    const isPrivate = x => isNaN(x) ? x.incognito : metaWindows[x].incognito;
    return isPrivate(windowIdOrObject1) == isPrivate(windowIdOrObject2);
}

async function moveTabs(windowId, tabObjects) {
    let pinnedTabIds;
    if (OPTIONS.move_pinned_tabs) {
        pinnedTabIds = tabObjects.filter(tab => tab.pinned).map(tab => tab.id);
        await Promise.all(pinnedTabIds.map(unpinTab));
    }

    const tabIds = tabObjects.map(tab => tab.id);
    await browser.tabs.move(tabIds, { windowId, index: -1 });

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);

    if (OPTIONS.keep_moved_active_tab_active) {
        const activeTabObject = tabObjects.find(tab => tab.active);
        if (activeTabObject) activateTab(activeTabObject.id);
    }
    if (OPTIONS.keep_moved_tabs_selected) {
        tabIds.forEach(selectTab);
    }
}

async function reopenTabs(windowId, tabObjects) {
    if (!OPTIONS.move_pinned_tabs) {
        tabObjects = tabObjects.filter(tab => !tab.pinned);
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
    tabObjects = await Promise.all(tabObjects.map(reopenTab));

    if (OPTIONS.keep_moved_tabs_selected) {
        tabObjects.forEach(tab => { if (tab && !tab.active) selectTab(tab.id) });
    }
}
