'use strict';

var WindowsData = {};
var LastWindowNumber = 0;
var ModifierKey = {
    sendTabs: 'shiftKey',
    bringTabs: 'ctrlKey',
};

initWindowsData();
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);


async function initWindowsData() {
    const allWindows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
    for (const window of allWindows) {
        const windowId = window.id;
        const tabCount = window.tabs.length;
        addWindowsDataItem(windowId, tabCount);
        updateWindowBadge(windowId);
    }
}

async function onWindowCreated(window) {
    const windowId = window.id;
    const tabs = await browser.tabs.query({ windowId });
    const tabCount = tabs.length;
    addWindowsDataItem(windowId, tabCount);
    updateWindowBadge(windowId);
}

function onWindowRemoved(windowId) {
    removeWindowsDataItem(windowId);
}

function onWindowFocused(windowId) {
    if (windowId in WindowsData) {
        WindowsData[windowId].lastFocused = Date.now();
    }
}

function onTabCreated(tab) {
    const windowId = tab.windowId;
    if (windowId in WindowsData) {
        WindowsData[windowId].tabCount++;
        updateWindowBadge(windowId);
    }
}

function onTabRemoved(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) return;
    const windowId = removeInfo.windowId;
    WindowsData[windowId].tabCount--;
    updateWindowBadge(windowId);
}

function onTabDetached(tabId, detachInfo) {
    const windowId = detachInfo.oldWindowId;
    WindowsData[windowId].tabCount--;
    updateWindowBadge(windowId);
}

function onTabAttached(tabId, attachInfo) {
    const windowId = attachInfo.newWindowId;
    WindowsData[windowId].tabCount++;
    updateWindowBadge(windowId);
}

function addWindowsDataItem(windowId, tabCount) {
    WindowsData[windowId] = {
        tabCount,
        lastFocused: Date.now(),
        defaultName: `Window ${++LastWindowNumber} / id ${windowId}`,
        name: ``,
        textColor: '#fff',
        backColor: '#00f',
    };
}

function removeWindowsDataItem(windowId) {
    delete WindowsData[windowId];
}

function focusWindow(windowId) {
    browser.windows.update(windowId, { focused: true });
}

async function moveSelectedTabs(windowId, stayActive, staySelected) {
    const selectedTabs = await browser.tabs.query({ currentWindow: true, highlighted: true });
    const selectedTabIds = selectedTabs.map(tab => tab.id);
    await browser.tabs.move(selectedTabIds, { windowId, index: -1 });

    if (stayActive) {
        const activeTab = objectArray.firstWith(selectedTabs, 'active', true);
        browser.tabs.update(activeTab.id, { active: true });
    }
    if (staySelected) {
        for (const tabId of selectedTabIds) {
            browser.tabs.update(tabId, { highlighted: true, active: false });
        }
    }
}

function updateWindowBadge(windowId) {
    const data = WindowsData[windowId];
    browser.browserAction.setBadgeText({ windowId, text: `${data.tabCount}` });
    browser.browserAction.setBadgeTextColor({ windowId, color: data.textColor });
    browser.browserAction.setBadgeBackgroundColor({ windowId, color: data.backColor });
}


var objectArray = {

    firstWith(objects, key, value) {
        for (const object of objects) {
            if (object[key] === value) return object;
        }
    },

}