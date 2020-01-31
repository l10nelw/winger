/*
Naming notes:
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- Data created and used by this addon pertaining to a window are 'metadata' and an object collecting
  them is a 'metawindow'. The metawindows live in Metadata.windows as the addon's source-of-truth.
- Window objects returned by the WebExtensions API are named windowObject to avoid confusion with the
  global window object.
*/

import * as Options from './options.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

// import * as Badge from './badge.js';
// import * as Menu from './menu.js';
import * as Title from './title.js';
const WindowParts = [Title];

init();
setIconTitle();
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);
browser.runtime.onMessage.addListener(onRequest);

async function init() {
    const [windowObjects,] = await Promise.all([browser.windows.getAll(), Options.retrieve()]);
    WindowParts.forEach(part => part.init());
    await Metadata.init(windowObjects);
    windowObjects.forEach(windowObject => onWindowCreated(windowObject, true));
}

async function setIconTitle() {
    const [{ name }, [{ shortcut }]] = await Promise.all([browser.management.getSelf(), browser.commands.getAll()]);
    browser.browserAction.setTitle({ title: `${name} (${shortcut})` });
}

async function onWindowCreated(windowObject, isInit) {
    if (!isInit) await Metadata.add(windowObject);
    const windowId = windowObject.id;
    WindowParts.forEach(part => part.create(windowId));
    if (windowObject.focused) onWindowFocused(windowId);
}

function onWindowRemoved(windowId) {
    Metadata.remove(windowId);
    // Menu.remove(windowId);
}

function onWindowFocused(windowId) {
    if (isWindowBeingCreated(windowId)) return;
    Metadata.windows[windowId].lastFocused = Date.now();
    // Menu.show(Metadata.focusedWindow.id);
    Metadata.focusedWindow.id = windowId;
    // Menu.hide(windowId);
}

function isWindowBeingCreated(windowId) {
    return !(windowId in Metadata.windows);
}

async function onRequest(request) {

    // From popup/popup.js
    if (request.popup) {
        const { bring_modifier, send_modifier } = Options.OPTIONS;
        return {
            OPTIONS: { bring_modifier, send_modifier },
            metaWindows: Metadata.windows,
            currentWindowId: Metadata.focusedWindow.id,
            sortedWindowIds: Metadata.sortedWindowIds(),
            selectedTabCount: (await WindowTab.getSelectedTabs()).length,
        };
    }
    if (request.goalAction) {
        WindowTab.goalAction(...request.goalAction);
        return;
    }

    // From popup/editmode.js
    if (request.giveName) {
        const windowId = request.windowId;
        const error = await Metadata.giveName(windowId, request.name);
        if (!error) WindowParts.forEach(part => part.update(windowId));
        return error;
    }
}