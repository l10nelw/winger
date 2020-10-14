/*
- Data created and used by this webextension pertaining to a window are 'metadata' and an object collecting them is a
  'metawindow'. The metawindows live in Metadata.windowMap as the webextension's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid confusion with the global window object.
*/

import * as Settings from './settings.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

import * as Title from './title.js';
let Badge, Menu;

// Object.assign(window, { Metadata }); // for debugging

init();
browser.runtime.onInstalled.addListener    (onExtInstalled);
browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);
browser.runtime.onMessage.addListener      (onRequest);

async function init() {
    const [windowObjects, SETTINGS] = await Promise.all([browser.windows.getAll(), Settings.retrieve()]);

    if (SETTINGS.show_badge) Badge = await import('./badge.js');

    await Metadata.init(windowObjects);
    windowObjects.forEach(windowObject => onWindowCreated(windowObject, true));

    const menusEnabled = [];
    if (SETTINGS.enable_tab_menu)  menusEnabled.push('tab');
    if (SETTINGS.enable_link_menu) menusEnabled.push('link');
    if (menusEnabled.length) {
        Menu = await import('./menu.js');
        Menu.init(menusEnabled);
    }
}

function onExtInstalled(details) {
    if (details.reason === 'install') WindowTab.openHelp();
}

async function onWindowCreated(windowObject, isInit) {
    if (!isInit) {
        await Metadata.add(windowObject);
        Menu?.update();
    }
    const windowId = windowObject.id;
    Title.update(windowId);
    Badge?.update(windowId);
    WindowTab.handleTearOff(windowId);
    if (windowObject.focused) onWindowFocused(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    Menu?.update();
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windowMap[windowId].lastFocused = Date.now();
    Metadata.focusedWindow.id = windowId;
}

async function onRequest(request) {

    // From popup/popup.js
    if (request.popup) {
        return {
            SETTINGS:         Settings.SETTINGS,
            metaWindows:      Metadata.sortedMetaWindows(),
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
        if (!error) {
            Title.update(windowId);
            Badge?.update(windowId);
        }
        return error;
    }
}

const isWindowBeingCreated = windowId => !(windowId in Metadata.windowMap);