import { OPTIONS } from './options.js';
import { windows as metaWindows } from './metadata.js';
import * as WindowTab from './windowtab.js';

let contexts = [];

export function init() {
    if (OPTIONS.enable_tab_menu) contexts.push('tab');
    if (OPTIONS.enable_link_menu) contexts.push('link');
    if (contexts.length) browser.menus.onClicked.addListener(onClick);
}

function onClick(info, tabObject) {
    const windowId = parseInt(info.menuItemId);
    const modifiers = info.modifiers;
    const url = info.linkUrl;
    if (url) {
        onClickLinkContext(url, windowId, modifiers);
    } else {
        onClickTabContext(tabObject, windowId, modifiers);
    }
}

function onClickLinkContext(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(OPTIONS.bringtab_modifier)) WindowTab.focusWindow(windowId);
}

async function onClickTabContext(tabObject, windowId, modifiers) {
    let tabObjects = await WindowTab.getSelectedTabs();
    if (tabObjects.length == 1) {
        // If no more than the active tab is selected, send only the target tab.
        tabObjects = [tabObject];
    } else if (!tabObjects.includes(tabObject)) {
        // If target tab is not among the selected tabs, include it.
        tabObjects.push(tabObject);
    }
    WindowTab.goalAction(windowId, modifiers, false, true, tabObjects);
}

export function create(windowId) {
    browser.menus.create({ id: `${windowId}`, title: menuTitle(windowId), contexts });
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
    return metaWindows[windowId].displayName;
}