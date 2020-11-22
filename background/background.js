/*
- Data created and used by this webextension pertaining to a window are 'metadata' and an object collecting them is a
  'metawindow'. The metawindows live in Metadata.windowMap as the webextension's source-of-truth.
*/

import * as Settings from './settings.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';
let Menu;

// Object.assign(window, { Metadata }); // for debugging

init();
browser.runtime.onInstalled.addListener    (onExtInstalled);
browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);
browser.runtime.onMessage.addListener      (onRequest);

async function init() {
    const [windows, SETTINGS] = await Promise.all([ browser.windows.getAll(), Settings.retrieve() ]);
    WindowTab.init(SETTINGS);
    await Metadata.init(SETTINGS, windows);
    windows.forEach(window => onWindowCreated(window, true));

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

async function onWindowCreated(window, isInit) {
    if (!isInit) {
        await Metadata.add(window);
        Menu?.update();
    }
    const windowId = window.id;
    WindowTab.deselectTearOff(windowId);
    if (window.focused) onWindowFocused(windowId);
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
            metaWindows:      Metadata.sorted(),
            currentWindowId:  Metadata.focusedWindow.id,
            selectedTabCount: (await WindowTab.getSelectedTabs()).length,
        };
    }
    if (request.action) return WindowTab.doAction(request);
    if (request.help) return WindowTab.openHelp();

    // From popup/editmode.js
    if (request.giveName) return Metadata.giveName(request.windowId, request.name);
}

const isWindowBeingCreated = windowId => !(windowId in Metadata.windowMap);