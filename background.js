'use strict';
// bg.metadata.js: Metadata
// bg.browserop.js: BrowserOp

Metadata.populate(BrowserOp.updateWindowBadge);
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);
browser.runtime.onConnect.addListener(onPortConnected);


async function onWindowCreated(window) {
    await Metadata.add(window);
    BrowserOp.updateWindowBadge(window.id);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
}

function onWindowFocused(windowId) {
    if (windowId in Metadata) {
        Metadata[windowId].lastFocused = Date.now();
        Metadata.focusedWindowId = windowId;
    }
}

function onTabCreated(tab) {
    const windowId = tab.windowId;
    if (windowId in Metadata) {
        Metadata[windowId].tabCount++;
        BrowserOp.updateWindowBadge(windowId);
    }
}

function onTabRemoved(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) return;
    const windowId = removeInfo.windowId;
    Metadata[windowId].tabCount--;
    BrowserOp.updateWindowBadge(windowId);
}

function onTabDetached(tabId, detachInfo) {
    const windowId = detachInfo.oldWindowId;
    Metadata[windowId].tabCount--;
    BrowserOp.updateWindowBadge(windowId);
}

function onTabAttached(tabId, attachInfo) {
    const windowId = attachInfo.newWindowId;
    Metadata[windowId].tabCount++;
    BrowserOp.updateWindowBadge(windowId);
}

function onPortConnected(port) {
    port.onMessage.addListener(message => {
        if (message.requestMetadata) {
            port.postMessage({
                focusedWindowId: Metadata.focusedWindowId,
                metaWindows: Metadata.items(),
            });
        }
        else
        if (message.browserOp) {
            BrowserOp[message.browserOp](...message.args);
        }
    })
}

