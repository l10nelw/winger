import { OPTIONS } from './options.js';

// Select the end-goal action based on any modifiers or sendTab override, given a target windowId.
// Array of target tabObjects is optional; if not explicitly given, sendTabs() will get them.
export function goalAction(windowId, modifiers, doBringTabs, doSendTabs, tabObjects) {
    if (doBringTabs || modifiers.includes(OPTIONS.bringtab_modifier)) {
        bringTabs(windowId, tabObjects);
    } else if (doSendTabs || modifiers.includes(OPTIONS.sendtab_modifier)) {
        sendTabs(windowId, tabObjects, OPTIONS.keep_sent_tabs_selected);
    } else {
        focusWindow(windowId);
    }
}

function bringTabs(windowId, tabObjects) {
    focusWindow(windowId);
    sendTabs(windowId, tabObjects, true);
}

async function sendTabs(windowId, tabObjects, staySelected) {
    if (!tabObjects || !tabObjects.length) {
        tabObjects = await getSelectedTabs();
    }
    const tabIds = tabObjects.map(tab => tab.id);
    let pinnedTabIds;
    if (OPTIONS.move_pinned_tabs) {
        pinnedTabIds = tabObjects.filter(tab => tab.pinned).map(tab => tab.id);
        await Promise.all(pinnedTabIds.map(unpinTab));
    }
    await browser.tabs.move(tabIds, { windowId, index: -1 });
    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);
    if (staySelected) {
        const activeTab = tabObjects.find(tab => tab.active);
        if (activeTab) browser.tabs.update(activeTab.id, { active: true });
        tabIds.forEach(highlightTab);
    }
}

function unpinTab(tabId) {
    return browser.tabs.update(tabId, { pinned: false });
}

function pinTab(tabId) {
    return browser.tabs.update(tabId, { pinned: true });
}

function highlightTab(tabId) {
    return browser.tabs.update(tabId, { highlighted: true, active: false });
}

export function focusWindow(windowId) {
    return browser.windows.update(windowId, { focused: true });
}

export async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
}