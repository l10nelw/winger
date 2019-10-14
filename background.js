'use strict';
// bg.metadata.js: Metadata

var ModifierKey = {
    sendTabs: 'shiftKey',
    bringTabs: 'ctrlKey',
};

Metadata.populate(updateWindowBadge);

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);


async function onWindowCreated(window) {
    await Metadata.add(window);
    updateWindowBadge(window.id);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
}

function onWindowFocused(windowId) {
    if (windowId in Metadata) {
        Metadata[windowId].lastFocused = Date.now();
    }
}

function onTabCreated(tab) {
    const windowId = tab.windowId;
    if (windowId in Metadata) {
        Metadata[windowId].tabCount++;
        updateWindowBadge(windowId);
    }
}

function onTabRemoved(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) return;
    const windowId = removeInfo.windowId;
    Metadata[windowId].tabCount--;
    updateWindowBadge(windowId);
}

function onTabDetached(tabId, detachInfo) {
    const windowId = detachInfo.oldWindowId;
    Metadata[windowId].tabCount--;
    updateWindowBadge(windowId);
}

function onTabAttached(tabId, attachInfo) {
    const windowId = attachInfo.newWindowId;
    Metadata[windowId].tabCount++;
    updateWindowBadge(windowId);
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
    const data = Metadata[windowId];
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