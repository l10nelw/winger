import { OPTIONS } from './options.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

let initialized = false;
let contexts = [];

export function create(windowId) {
    if (!initialized) init();
    browser.menus.create({ id: `${windowId}`, title: menuTitle(windowId), contexts });
}

function init() {
    if (OPTIONS.enable_tab_menu) contexts.push('tab');
    if (OPTIONS.enable_link_menu) contexts.push('link');
    if (contexts.length) {
        browser.menus.onClicked.addListener(onClick);
    }
    initialized = true;
}

async function onClick(info, tabObject) {
    const windowId = parseInt(info.menuItemId);
    const url = info.linkUrl;
    if (url) {
        // Link context
        browser.tabs.create({ windowId, url });
        if (info.modifiers.includes(modifier.bringTab)) WindowTab.focusWindow(windowId);
    } else {
        // Tab context
        // If multiple tabs selected: Send selected tabs, active tab and target tab. Else send target tab only.
        let tabObjects = [tabObject, ...await WindowTab.getSelectedTabs()];
        WindowTab.goalAction(windowId, info.modifiers, true, tabObjects);
    }
}

export function remove(windowId) {
    browser.menus.remove(`${windowId}`);
}

export function hide(windowId) {
    browser.menus.update(`${windowId}`, { visible: false });
}

export function show(windowId) {
    browser.menus.update(`${windowId}`, { visible: true });
}

export function update(windowId) {
    browser.menus.update(`${windowId}`, { title: menuTitle(windowId) });
}

function menuTitle(windowId) {
    return Metadata.windows[windowId].displayName;
}