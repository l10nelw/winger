import { SETTINGS } from './settings.js';
import { windows as metaWindows } from './metadata.js';
import * as WindowTab from './windowtab.js';

let contexts = [];

export function init() {
    if (SETTINGS.enable_tab_menu) contexts.push('tab');
    if (SETTINGS.enable_link_menu) contexts.push('link');
    if (contexts.length) browser.menus.onClicked.addListener(onClick);
}

function onClick(info, tab) {
    const windowId = parseInt(info.menuItemId);
    const url = info.linkUrl;
    if (url) {
        openLink(url, windowId, info.modifiers);
    } else {
        moveTab(tab, windowId, tab.windowId, info.modifiers);
    }
}

function openLink(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(SETTINGS.bring_modifier)) WindowTab.focusWindow(windowId);
}

async function moveTab(tab, windowId, originWindowId, modifiers) {
    let tabs = await WindowTab.getSelectedTabs();
    if (tabs.length === 1) {
        // If there is no multiple tab selection, select only the target tab
        tabs = [tab];
    } else if (!tabs.some(t => t.id === tab.id)) {
        // If target tab is not among the selected tabs, include it
        tabs.push(tab);
        tabs.sort((a, b) => a.index - b.index);
    }
    WindowTab.doAction({ action: 'send', windowId, originWindowId, modifiers, tabs });
}

const menuTitle = windowId => `Send to ${metaWindows[windowId].displayName}`;
export const create = windowId => browser.menus.create({ id: `${windowId}`, title: menuTitle(windowId), contexts });
export const remove = windowId => browser.menus.remove(`${windowId}`);
export const hide   = windowId => browser.menus.update(`${windowId}`, { visible: false });
export const show   = windowId => browser.menus.update(`${windowId}`, { visible: true });
export const update = windowId => browser.menus.update(`${windowId}`, { title: menuTitle(windowId) });