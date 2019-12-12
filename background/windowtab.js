const modifier = {
    sendTab: 'Alt',
    bringTab: 'Ctrl',
}

export function goalAction(windowId, modifiers, doSendTabs, tabObjects) {
    if (modifiers.includes(modifier.bringTab)) {
        bringTabs(windowId, tabObjects);
    } else if (doSendTabs || modifiers.includes(modifier.sendTab)) {
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

export async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
}

export function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}
