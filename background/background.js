/*
Naming notes:
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Data created and used by this addon pertaining to a window are 'metadata' and an object collecting
  them is a 'metawindow'. The metawindows live in Metadata.windows as the addon's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid confusion with the
  global window object.
*/

import { retrieveOptions } from './options.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';
import * as Menu from './menu.js';
import * as Title from './title.js';
import * as Badge from './badge.js';

init();
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.tabs.onCreated.addListener(onTabCreated);
browser.tabs.onRemoved.addListener(onTabRemoved);
browser.tabs.onDetached.addListener(onTabDetached);
browser.tabs.onAttached.addListener(onTabAttached);
browser.runtime.onMessage.addListener(onRequest);

async function init() {
    const gettingAllWindows = browser.windows.getAll({ populate: true });
    const [allWindows, _] = await Promise.all([gettingAllWindows, retrieveOptions()]);
    for (const windowObject of allWindows) {
        await onWindowCreated(windowObject, true);
    }
}

async function onWindowCreated(windowObject, isInit) {
    await Metadata.add(windowObject);
    const windowId = windowObject.id;
    Menu.create(windowId);
    Badge.update(windowId);
    Title.update(windowId);
    // Handle focus now because onFocusChanged fired (after onCreated) while Metadata.add() is still being fulfilled.
    if (isInit && !windowObject.focused) return; // Limit focus handling during init()
    onWindowFocused(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    Menu.remove(windowId);
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].lastFocused = Date.now();
    Menu.show(Metadata.focusedWindow.id);
    Metadata.focusedWindow.id = windowId;
    Menu.hide(windowId);
}

function onTabCreated(tabObject) {
    const windowId = tabObject.windowId;
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].tabCount++;
    Badge.update(windowId);
}

function onTabRemoved(tabId, info) {
    if (info.isWindowClosing) return;
    const windowId = info.windowId;
    Metadata.windows[windowId].tabCount--;
    Badge.update(windowId);
}

function onTabDetached(tabId, info) {
    const windowId = info.oldWindowId;
    Metadata.windows[windowId].tabCount--;
    Badge.update(windowId);
}

function onTabAttached(tabId, info) {
    const windowId = info.newWindowId;
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].tabCount++;
    Badge.update(windowId);
}

function isWindowBeingCreated(windowId) {
    return !(windowId in Metadata.windows);
}

async function onRequest(request) {
    if (request.popup) {
        return {
            metaWindows: Metadata.windows,
            currentWindowId: Metadata.focusedWindow.id,
            sortedIds: Metadata.sortedIds(),
        };
    }
    if (request.setName) {
        const windowId = request.windowId;
        const error = await Metadata.setName(windowId, request.name);
        if (!error) {
            Title.update(windowId);
            Menu.update(windowId);
        }
        return error;
    }
    if (request.goalAction) {
        WindowTab.goalAction(...request.goalAction);
        return;
    }
}