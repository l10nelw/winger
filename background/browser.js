import * as Metadata from './metadata.js';

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

async function getSelectedTabs() {
    return await browser.tabs.query({ currentWindow: true, highlighted: true });
}

function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

export const badge = {
    update: windowId => {
        const metaWindow = Metadata.windows[windowId];
        browser.browserAction.setBadgeText({ windowId, text: `${metaWindow.tabCount}` });
        browser.browserAction.setBadgeTextColor({ windowId, color: 'black' });
        browser.browserAction.setBadgeBackgroundColor({ windowId, color: 'white' });
    },
};

export const title = {
    update: windowId => {
        browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
    },
};

function windowTitle(windowId) {
    return `${Metadata.windows[windowId].displayName} - `;
}

export const menu = {
    create: windowId => browser.menus.create({
        id: `${windowId}`,
        title: menuTitle(windowId),
        contexts: ['tab', 'link'],
    }),
    remove: windowId => browser.menus.remove(`${windowId}`),
    hide: windowId => browser.menus.update(`${windowId}`, { visible: false }),
    show: windowId => browser.menus.update(`${windowId}`, { visible: true }),
    update: windowId => browser.menus.update(`${windowId}`, { title: menuTitle(windowId) }),
    onClick: async (info, tabObject) => {
        const windowId = parseInt(info.menuItemId);
        const url = info.linkUrl;
        if (url) {
            // Link context
            browser.tabs.create({ windowId, url });
            if (info.modifiers.includes(modifier.bringTab)) focusWindow(windowId);
        } else {
            // Tab context
            // If multiple tabs selected: Send selected tabs, active tab and target tab. Else send target tab only.
            let tabObjects = [tabObject, ...await getSelectedTabs()];
            goalAction(windowId, info.modifiers, true, tabObjects);
        }
    }
};

function menuTitle(windowId) {
    return Metadata.windows[windowId].displayName;
}