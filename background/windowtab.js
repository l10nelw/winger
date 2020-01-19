import { OPTIONS } from './options.js';
import { windows as metaWindows } from './metadata.js';

// Select the end-goal action based on various inputs, given the target windowId.
// Relevant modifiers may override given doBringTabs/doSendTabs booleans.
// If tabObjects not given, moveTabs() will find currently selected tabs.
export async function goalAction(windowId, modifiers, doBringTabs, doSendTabs, tabObjects) {
    if (doBringTabs || modifiers.includes(OPTIONS.bringtab_modifier)) {
        moveTabs(windowId, tabObjects, true, true); // Bring tabs to window
    } else if (doSendTabs || modifiers.includes(OPTIONS.sendtab_modifier)) {
        moveTabs(windowId, tabObjects, OPTIONS.keep_sent_tabs_selected);  // Send tabs to window
    } else {
        focusWindow(windowId); // Switch to window
    }
}

async function moveTabs(windowId, tabObjects, doStaySelected, doFocusWindow) {
    tabObjects = tabObjects || await getSelectedTabs();
    if (doFocusWindow) focusWindow(windowId);

    // If either origin or destination is incognito, reopen tabs instead of move.
    if (sameContext(windowId, tabObjects[0])) {
        // Move
        const tabIds = tabObjects.map(tab => tab.id);
        let pinnedTabIds;
        if (OPTIONS.move_pinned_tabs) {
            pinnedTabIds = tabObjects.filter(tab => tab.pinned).map(tab => tab.id);
            await Promise.all(pinnedTabIds.map(unpinTab));
        }
        await browser.tabs.move(tabIds, { windowId, index: -1 });
        if (pinnedTabIds) pinnedTabIds.forEach(pinTab);
        if (doStaySelected) {
            const activeTabObject = tabObjects.find(tab => tab.active);
            if (activeTabObject) activateTab(activeTabObject.id);
            tabIds.forEach(selectTab);
        }
    } else {
        // Reopen
        if (!OPTIONS.move_pinned_tabs) tabObjects = tabObjects.filter(tab => !tab.pinned);
        tabObjects = await reopenTabs(windowId, tabObjects);
        if (doStaySelected) tabObjects.forEach(tab => { if (!tab.active) selectTab(tab.id) });
    }
}

export function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

export async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
}

function sameContext(windowIdOrObject1, windowIdOrObject2) {
    const isIncognito = x => isNaN(x) ? x.incognito : metaWindows[x].incognito;
    return isIncognito(windowIdOrObject1) == isIncognito(windowIdOrObject2);
}

function unpinTab(tabId) {
    return browser.tabs.update(tabId, { pinned: false });
}

function pinTab(tabId) {
    return browser.tabs.update(tabId, { pinned: true });
}

function activateTab(tabId) {
    return browser.tabs.update(tabId, { active: true });
}

function selectTab(tabId) {
    return browser.tabs.update(tabId, { highlighted: true, active: false });
}

function reopenTabs(windowId, tabObjects) {
    function reopen(tab) {
        browser.tabs.remove(tab.id);
        return browser.tabs.create({
            windowId,
            url: tab.url,
            pinned: tab.pinned,
            active: tab.active,
            discarded: tab.discarded,
            isInReaderMode: tab.isInReaderMode,
        });
    }
    return Promise.all(tabObjects.map(reopen));
}