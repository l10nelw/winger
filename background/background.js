/*
Naming notes:
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Data created and used by this addon pertaining to a window are 'metadata' and an object collecting
  them is a 'metawindow'. The metawindows live in Metadata.windows as the addon's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid possible conflicts
  with the global window object.
*/

import * as Metadata from './metadata.js';
import * as BrowserOp from './browser.js';
Object.assign(window, { Metadata, BrowserOp });

init();
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);
browser.runtime.onMessage.addListener(onRequest);
browser.menus.onClicked.addListener(BrowserOp.menu.onClick);

async function init() {
    const allWindows = await browser.windows.getAll({ populate: true });
    for (const windowObject of allWindows) {
        await onWindowCreated(windowObject);
        if (windowObject.focused) Metadata.focusedWindow.id = windowObject.id;
    }
}

async function onWindowCreated(windowObject) {
    await Metadata.add(windowObject);
    const windowId = windowObject.id;
    BrowserOp.badge.update(windowId);
    BrowserOp.title.update(windowId);
    BrowserOp.menu.create(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    BrowserOp.menu.remove(windowId);
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].lastFocused = Date.now();
    BrowserOp.menu.hide(windowId);
    BrowserOp.menu.show(Metadata.focusedWindow.id);
    Metadata.focusedWindow.id = windowId;
}

function onTabCreated(tabObject) {
    const windowId = tabObject.windowId;
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].tabCount++;
    BrowserOp.badge.update(windowId);
}

function onTabRemoved(tabId, info) {
    if (info.isWindowClosing) return;
    const windowId = info.windowId;
    Metadata.windows[windowId].tabCount--;
    BrowserOp.badge.update(windowId);
}

function onTabDetached(tabId, info) {
    const windowId = info.oldWindowId;
    Metadata.windows[windowId].tabCount--;
    BrowserOp.badge.update(windowId);
}

function onTabAttached(tabId, info) {
    const windowId = info.newWindowId;
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].tabCount++;
    BrowserOp.badge.update(windowId);
}

function isWindowBeingCreated(windowId) {
    return !(windowId in Metadata.windows);
}

function onRequest(request) {
    if (request.popup) {
        return Promise.resolve({
            metaWindows: Metadata.windows,
            currentWindowId: Metadata.focusedWindow.id,
            sortedIds: Metadata.sortedIds(),
        });
    }
    if (request.module) {
        return Promise.resolve(window[request.module][request.prop](...request.args));
    }
}