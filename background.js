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
        setWindowBadge(windowId, tabCount, '#fff', '#00f');
    }
}

async function onWindowCreated(window) {
    const windowId = window.id;
    const tabs = await browser.tabs.query({ windowId });
    const tabCount = tabs.length;
    addWindowsDataItem(windowId, tabCount);
    setWindowBadge(windowId, tabCount, '#fff', '#00f');
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
        setWindowBadge(windowId, ++WindowsData[windowId].tabCount);
    }
}

function onTabRemoved(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) return;
    const windowId = removeInfo.windowId;
    setWindowBadge(windowId, --WindowsData[windowId].tabCount);
}

function onTabDetached(tabId, detachInfo) {
    const windowId = detachInfo.oldWindowId;
    setWindowBadge(windowId, --WindowsData[windowId].tabCount);
}

function onTabAttached(tabId, attachInfo) {
    const windowId = attachInfo.newWindowId;
    setWindowBadge(windowId, ++WindowsData[windowId].tabCount);
}

function addWindowsDataItem(windowId, tabCount) {
    WindowsData[windowId] = {
        tabCount,
        lastFocused: Date.now(),
        defaultName: `Window ${++LastWindowNumber} / id ${windowId}`,
        name: ``,
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

function setWindowBadge(windowId, content, textColor, backColor) {
    if (content) browser.browserAction.setBadgeText({ windowId, text: `${content}` });
    if (textColor) browser.browserAction.setBadgeTextColor({ windowId, color: textColor });
    if (backColor) browser.browserAction.setBadgeBackgroundColor({ windowId, color: backColor });
}


var objectArray = {

    firstWith(objects, key, value) {
        for (const object of objects) {
            if (object[key] === value) return object;
        }
    },

}