import * as Metadata from './metadata.js';
import * as BrowserOp from './browser.js';
window.Metadata = Metadata;
window.BrowserOp = BrowserOp;

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
    // If multiple tabs selected: Send selected tabs, active tab and target tab.
    let tabObjects = await BrowserOp.getSelectedTabs();
    tabObjects.push(tabObject);
    const windowId = parseInt(info.menuItemId);
    BrowserOp.goalAction(windowId, info.modifiers, true, tabObjects);
}


function onPortConnected(port) {

    if (port.name == 'popup') {
        port.postMessage({
            response: 'popup open',
            metaWindows: Metadata.windows,
            focusedWindowId: Metadata.focusedWindowId,
            sortedIds: Metadata.sortedIds(),
        });
    }

    port.onMessage.addListener(handleMessage);

    async function handleMessage(message) {
        if (message.command) {
            callViaMessage(message);
        } else
        if (message.request) {
            port.postMessage({
                response: message.request,
                result: await callViaMessage(message),
                windowId: message.windowId,
            });
        }
    }

    async function callViaMessage(message) {
        const args = message.args;
        if (args) {
            return await window[message.module][message.prop](...args);
        } else {
            return window[message.module][message.prop];
        }
    }

}
