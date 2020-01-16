import { OPTIONS } from './options.js';

// Select the end-goal action based on various inputs, given the target windowId.
// Relevant modifiers may override given doBringTabs/doSendTabs booleans.
// Array of target tabObjects is optional; if not given, moveTabs() will target currently selected tabs.
export function goalAction(windowId, modifiers, doBringTabs, doSendTabs, tabObjects) {
    if (doBringTabs || modifiers.includes(OPTIONS.bringtab_modifier)) {
        moveTabs(windowId, tabObjects, true, true); // Bring tabs to window
    } else if (doSendTabs || modifiers.includes(OPTIONS.sendtab_modifier)) {
        moveTabs(windowId, tabObjects, false, OPTIONS.keep_sent_tabs_selected); // Send tabs to window
    } else {
        focusWindow(windowId); // Switch to window
    }
}

async function moveTabs(windowId, tabObjects, doFocusWindow, doStaySelected) {
    if (!tabObjects) tabObjects = await getSelectedTabs();
    if (doFocusWindow) focusWindow(windowId);
    const tabIds = tabObjects.map(tab => tab.id);
    let pinnedTabIds;
    if (OPTIONS.move_pinned_tabs) {
        pinnedTabIds = tabObjects.filter(tab => tab.pinned).map(tab => tab.id);
        await Promise.all(pinnedTabIds.map(unpinTab));
    }
    await browser.tabs.move(tabIds, { windowId, index: -1 });
    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);
    if (doStaySelected) {
        const activeTab = tabObjects.find(tab => tab.active);
        if (activeTab) browser.tabs.update(activeTab.id, { active: true });
        tabIds.forEach(highlightTab);
    }
}

export function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

export async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
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
