/*
- Data created and used by this webextension pertaining to a window are 'metadata' and an object collecting them is a
  'metawindow'. The metawindows live in Metadata.windowMap as the webextension's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid confusion with the global window object.
*/

import * as Settings from './settings.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

import * as Badge from './badge.js';
import * as Menu from './menu.js';
import * as Title from './title.js';

// Object.assign(window, { Metadata }); // for debugging

init();
browser.runtime.onInstalled.addListener    (onExtInstalled);
browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);
browser.tabs.onDetached.addListener        (onTabDetached);
browser.runtime.onMessage.addListener      (onRequest);

async function init() {
    const [windowObjects,] = await Promise.all([browser.windows.getAll(), Settings.retrieve()]);
    Menu.init();
    await Metadata.init(windowObjects);
    windowObjects.forEach(onWindowCreated);
}

function onExtInstalled(details) {
    if (details.reason === 'install') WindowTab.openHelp();
}

async function onWindowCreated(windowObject) {
    await Metadata.add(windowObject);
    const windowId = windowObject.id;
    Menu.create(windowId);
    Badge.update(windowId);
    Title.update(windowId);
    WindowTab.handleTornOffWindow(windowId);
    if (windowObject.focused) onWindowFocused(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    Menu.remove(windowId);
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windowMap[windowId].lastFocused = Date.now();
    Menu.show(Metadata.focusedWindow.id);
    Menu.hide(windowId);
    Metadata.focusedWindow.id = windowId;
}

const isWindowBeingCreated = windowId => !(windowId in Metadata.windowMap);

function onTabDetached(tabId, { oldWindowId }) {
    Metadata.lastDetach.set(tabId, oldWindowId);
}

async function onRequest(request) {

    // From popup/popup.js
    if (request.popup) {
        return {
            SETTINGS:         Settings.SETTINGS,
            metaWindows:      Object.values(Metadata.windowMap),
            currentWindowId:  Metadata.focusedWindow.id,
            selectedTabCount: (await WindowTab.getSelectedTabs()).length,
        };
    }
    if (request.action) return WindowTab.doAction(request);
    if (request.help) return WindowTab.openHelp();

    // From popup/editmode.js
    if (request.giveName) {
        const windowId = request.windowId;
        const error = await Metadata.giveName(windowId, request.name);
        if (!error) [Badge, Menu, Title].forEach(module => module.update(windowId));
        return error;
    }
}