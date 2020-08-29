import { SETTINGS } from './settings.js';
import { sortedMetaWindows, getName } from './metadata.js';
import * as WindowTab from './windowtab.js';

const contextTitle = {
    tab:  'Send Tab(s) to &Window...',
    link: 'Open Link in &Window...',
}

// Create a parent menu item for each context in array `menusEnabled`.
export function init(menusEnabled) {
    for (const context of menusEnabled) {
        const contexts = [context];
        browser.menus.create({ contexts, id: context, title: contextTitle[context] });
        browser.menus.create({ contexts, parentId: context, id: `-${context}`, title: '-' }); // Dummy to avoid menu resizing onShown
    }
}

// Clear and populate `context` menu with other-window menu items, sorted by lastFocsued.
export function populate(context, currentWindowId) {
    const props = { contexts: [context], parentId: context };
    for (const { id: windowId } of sortedMetaWindows()) {
        const menuId = `${windowId}-${context}`;
        browser.menus.remove(menuId);
        if (windowId == currentWindowId) continue;
        browser.menus.create({ ...props, id: menuId, title: getName(windowId) });
    }
    browser.menus.remove(`-${context}`); // Remove dummy if it exists
}

// Show or hide all menus.
export function show(menusEnabled, visible = true) {
    const props = { visible };
    menusEnabled.forEach(context => browser.menus.update(context, props));
}

export function openLink(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(SETTINGS.bring_modifier)) WindowTab.switchWindow(windowId);
}

export async function moveTab(tab, windowId, originWindowId, modifiers) {
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
