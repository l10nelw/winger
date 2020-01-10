import { OPTIONS } from './options.js';

// Select the end-goal action based on any modifiers or sendTab override, given a target windowId.
// Array of target tabObjects is optional; if not explicitly given, sendTabs() will get them.
export function goalAction(windowId, modifiers, doBringTabs, doSendTabs, tabObjects) {
    if (doBringTabs || modifiers.includes(OPTIONS.bring_tab_modifier)) {
        bringTabs(windowId, tabObjects);
    } else if (doSendTabs || modifiers.includes(OPTIONS.send_tab_modifier)) {
        sendTabs(windowId, tabObjects);
    } else {
        focusWindow(windowId);
    }
}

function bringTabs(windowId, tabObjects) {
    focusWindow(windowId);
    sendTabs(windowId, tabObjects, true, true);
}

async function sendTabs(windowId, tabObjects, stayActive, staySelected) {
    if (!tabObjects || !tabObjects.length) {
        tabObjects = await getSelectedTabs();
    }
    const tabIds = tabObjects.map(tab => tab.id);
    await browser.tabs.move(tabIds, { windowId, index: -1 });
    if (stayActive) {
        const activeTab = tabObjects.find(tab => tab.active);
        if (activeTab) browser.tabs.update(activeTab.id, { active: true });
    }
    if (staySelected) {
        for (const tabId of tabIds) {
            browser.tabs.update(tabId, { highlighted: true, active: false });
        }
    }
}

export function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

export async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
}