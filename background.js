'use strict';
// bg.metadata.js: Metadata
// bg.browserop.js: BrowserOp

Metadata.init([BrowserOp.updateWindowBadge, BrowserOp.menu.create]);

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);

browser.runtime.onConnect.addListener(onPortConnected);

browser.contextMenus.onClicked.addListener(onMenuClicked);


async function onWindowCreated(windowObject) {
    await Metadata.add(windowObject);
    const windowId = windowObject.id;
    BrowserOp.updateWindowBadge(windowId);
    BrowserOp.menu.create(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    BrowserOp.menu.remove(windowId);
}

function onWindowFocused(windowId) {
    if (!(windowId in Metadata.windows)) return;
    Metadata.windows[windowId].lastFocused = Date.now();
    BrowserOp.menu.show(Metadata.focusedWindowId);
    BrowserOp.menu.hide(windowId);
    Metadata.focusedWindowId = windowId;
}

function onTabCreated(tab) {
    const windowId = tab.windowId;
    if (!(windowId in Metadata.windows)) return;
    Metadata.windows[windowId].tabCount++;
    BrowserOp.updateWindowBadge(windowId);
}

function onTabRemoved(tabId, info) {
    if (info.isWindowClosing) return;
    const windowId = info.windowId;
    Metadata.windows[windowId].tabCount--;
    BrowserOp.updateWindowBadge(windowId);
}

function onTabDetached(tabId, info) {
    const windowId = info.oldWindowId;
    Metadata.windows[windowId].tabCount--;
    BrowserOp.updateWindowBadge(windowId);
}

function onTabAttached(tabId, info) {
    const windowId = info.newWindowId;
    Metadata.windows[windowId].tabCount++;
    BrowserOp.updateWindowBadge(windowId);
}


function onPortConnected(port) {
    if (port.name == 'popup') {
        Metadata.sort();
        port.postMessage({
            metaWindowsMap: Metadata.windows,
            focusedWindowId: Metadata.focusedWindowId,
            sortedIds: Metadata.sortedIds,
            sortBy: Metadata.sortBy,
        });
    }
    port.onMessage.addListener(message => {
        if (message.browserOp) {
            BrowserOp[message.browserOp](...message.args);
        }
    })
}


async function onMenuClicked(info, tabObject) {
    let tabObjects = await BrowserOp.getSelectedTabs();
    if (tabObjects.length == 1) {
        // Only active tab, treat as not selected => Just send target tab
        tabObjects = [tabObject];
    } else {
        // Multiple tabs selected => Send selected tabs, active tab and target tab
        // API should ignore duplicates
        tabObjects.push(tabObject);
    }
    const windowId = parseInt(info.menuItemId);
    BrowserOp.respond(windowId, info.modifiers, true, tabObjects);
}
