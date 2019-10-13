var POPULATE_TABS = { populate: true, windowTypes: ['normal'] };

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


async function initWindowsData() {
    const allWindows = await browser.windows.getAll(POPULATE_TABS);
    for (const window of allWindows) {
        const windowId = window.id;
        const tabCount = window.tabs.length;
        addWindowsDataItem(windowId, tabCount);
        setWindowBadge(windowId, tabCount, '#fff', '#00f');
    }
}

async function onWindowCreated(window) {
    const windowId = window.id;
    const tabs = await browser.tabs.query({ currentWindow: true });
    const tabCount = tabs.length;
    addWindowsDataItem(windowId, tabCount);
    setWindowBadge(windowId, tabCount, '#fff', '#00f');
}

function onWindowRemoved(windowId) {
    removeWindowsDataItem(windowId);
}

function onWindowFocused(windowId) {
    if (windowId > 0) {
        WindowsData[windowId].lastFocused = Date.now();
    }
}

function addWindowsDataItem(windowId, tabCount) {
    WindowsData[windowId] = {
        tabCount: tabCount,
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
    await browser.tabs.move(selectedTabIds, { windowId: windowId, index: -1 });

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

function setWindowBadge(windowId, value, textColor, backColor) {
    browser.browserAction.setBadgeText({ windowId: windowId, text: `${value}` });
    if (textColor) browser.browserAction.setBadgeTextColor({ windowId: windowId, color: textColor });
    if (backColor) browser.browserAction.setBadgeBackgroundColor({ windowId: windowId, color: backColor });
}


var objectArray = {

    firstWith(objects, key, value) {
        for (const object of objects) {
            if (object[key] === value) return object;
        }
    },

}