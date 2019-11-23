import * as Metadata from './metadata.js';
import * as BrowserOp from './browser.js';
const modules = { Metadata, BrowserOp };

Metadata.init();

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);

browser.runtime.onMessage.addListener(handleRequest);

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
    if (!Metadata.has(windowId)) return;
    Metadata.windows[windowId].lastFocused = Date.now();
    BrowserOp.menu.show(Metadata.focusedWindowId);
    BrowserOp.menu.hide(windowId);
    Metadata.setFocused(windowId);
}

function onTabCreated(tabObject) {
    const windowId = tabObject.windowId;
    if (!Metadata.has(windowId)) return;
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
    if (!Metadata.has(windowId)) return;
    Metadata.windows[windowId].tabCount++;
    BrowserOp.updateWindowBadge(windowId);
}


async function onMenuClicked(info, tabObject) {
    // If multiple tabs selected: Send selected tabs, active tab and target tab. Else send target tab.
    let tabObjects = await BrowserOp.getSelectedTabs();
    tabObjects.push(tabObject);
    const windowId = parseInt(info.menuItemId);
    BrowserOp.goalAction(windowId, info.modifiers, true, tabObjects);
}


function handleRequest(request) {
    if (request.popup) {
        return Promise.resolve({
            metaWindows: Metadata.windows,
            focusedWindowId: Metadata.focusedWindowId,
            sortedIds: Metadata.sortedIds(),
        });
    }
    if (request.module) {
        return callViaMessage(request);
    }
}

async function callViaMessage(request) {
    const args = request.args;
    if (args) {
        return modules[request.module][request.prop](...args);
    } else {
        return modules[request.module][request.prop];
    }
}