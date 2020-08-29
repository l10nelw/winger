/*
- Data created and used by this webextension pertaining to a window are 'metadata' and an object collecting them is a
  'metawindow'. The metawindows live in Metadata.windowMap as the webextension's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid confusion with the global window object.
*/

import * as Settings from './settings.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

import * as Badge from './badge.js';
import * as Title from './title.js';
import * as Menu from './menu.js';

// Object.assign(window, { Metadata }); // for debugging

const menusEnabled = [];
init();
browser.runtime.onInstalled.addListener    (onExtInstalled);
browser.windows.onCreated.addListener      (onWindowCreated);
browser.windows.onRemoved.addListener      (onWindowRemoved);
browser.windows.onFocusChanged.addListener (onWindowFocused);
browser.tabs.onDetached.addListener        (onTabDetached);
browser.runtime.onMessage.addListener      (onRequest);

async function init() {
    const [windowObjects, SETTINGS] = await Promise.all([browser.windows.getAll(), Settings.retrieve()]);

    await Metadata.init(windowObjects);
    windowObjects.forEach(windowObject => onWindowCreated(windowObject, true));

    if (SETTINGS.enable_tab_menu)  menusEnabled.push('tab');
    if (SETTINGS.enable_link_menu) menusEnabled.push('link');
    if (menusEnabled.length) {
        Menu.init(menusEnabled);
        browser.menus.onShown.addListener   (onMenuShow);
        browser.menus.onClicked.addListener (onMenuClick);
        setMenuVisibility();
    }
}

function onExtInstalled(details) {
    if (details.reason === 'install') WindowTab.openHelp();
}

async function onWindowCreated(windowObject, isInit) {
    await Metadata.add(windowObject);
    const windowId = windowObject.id;
    Badge.update(windowId);
    Title.update(windowId);
    WindowTab.handleTornOffWindow(windowId);
    if (windowObject.focused) onWindowFocused(windowId);
    if (!isInit) setMenuVisibility();
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    setMenuVisibility();
}

function setMenuVisibility() {
    Menu.show(menusEnabled, Metadata.count > 1);
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windowMap[windowId].lastFocused = Date.now();
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
            Badge.update(windowId);
            Title.update(windowId);
        }
        return error;
    }
}

function onMenuShow(info, tab) {
    const context = info.contexts.includes('link') ? 'link' : 'tab';
    Menu.populate(context, tab.windowId);
    browser.menus.refresh();
}

function onMenuClick(info, tab) {
    const windowId = parseInt(info.menuItemId);
    if (!windowId) return;
    const url = info.linkUrl;
    url ? Menu.openLink(url, windowId, info.modifiers)
        : Menu.moveTab(tab, windowId, tab.windowId, info.modifiers);
}
