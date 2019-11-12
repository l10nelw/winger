import * as Metadata from './metadata.js';

const modifier = {
    sendTab: 'Alt', // moveTabs
    bringTab: 'Ctrl', // moveTabs + focusWindow
}

export function goalAction(windowId, modifiers, sendTabsByDefault, tabObjects) {
    if (modifiers.includes(modifier.bringTab)) {
        focusWindow(windowId);
        moveTabs(tabObjects, windowId, true, true);
    } else if (modifiers.includes(modifier.sendTab) || sendTabsByDefault) {
        moveTabs(tabObjects, windowId);
    } else {
        focusWindow(windowId);
    }
}

function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

async function moveTabs(tabObjects, windowId, stayActive, staySelected) {
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

export function updateWindowBadge(windowId) {
    const data = Metadata.windows[windowId];
    browser.browserAction.setBadgeText({ windowId, text: `${data.tabCount}` });
    browser.browserAction.setBadgeTextColor({ windowId, color: data.textColor });
    browser.browserAction.setBadgeBackgroundColor({ windowId, color: data.backColor });
}

export const menu = {
    create: windowId => browser.contextMenus.create({
        id: `${windowId}`,
        title: `Send tab to ${Metadata.windows[windowId].displayName}`,
        contexts: ['tab'],
    }),
    remove: windowId => browser.contextMenus.remove(`${windowId}`),
    hide: windowId => browser.contextMenus.update(`${windowId}`, { visible: false }),
    show: windowId => browser.contextMenus.update(`${windowId}`, { visible: true }),
}
