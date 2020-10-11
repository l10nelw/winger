import * as Modifier from '../modifier.js';
import * as Metadata from './metadata.js';
import * as WindowTab from './windowtab.js';

let contextsEnabled;
const contextTitle = {
    tab:  'Send Tab(s) to &Window...',
    link: 'Open Link in &Window...',
}

// Create a parent menu item for each given context.
export function init(contextList) {
    contextsEnabled = contextList;
    for (const context of contextsEnabled) {
        const contexts = [context];
        browser.menus.create({ contexts, id: context, title: contextTitle[context] });
        browser.menus.create({ contexts, parentId: context, id: `-${context}`, title: '-' }); // Dummy to avoid menu resizing onShown
    }
    update();
    browser.menus.onShown.addListener   (onMenuShow);
    browser.menus.onClicked.addListener (onMenuClick);
}

function onMenuShow(info, tab) {
    if (!tab) return;
    const context = info.contexts.includes('link') ? 'link' : 'tab';
    populate(context, tab.windowId);
    browser.menus.refresh();
}

function onMenuClick(info, tab) {
    const windowId = parseInt(info.menuItemId);
    if (!windowId) return;
    const url = info.linkUrl;
    url ? openLink (url, windowId, info.modifiers)
        : moveTab  (tab, windowId, info.modifiers, tab.windowId);
}

// Update menu visibility based on window count.
export function update() {
    const props = { visible: Metadata.count > 1 };
    contextsEnabled.forEach(context => browser.menus.update(context, props));
}

// Clear and populate `context` menu with other-window menu items, sorted by lastFocsued.
function populate(context, currentWindowId) {
    const props = { contexts: [context], parentId: context };
    for (const { id: windowId } of Metadata.sortedMetaWindows()) {
        const menuId = `${windowId}-${context}`;
        browser.menus.remove(menuId);
        if (windowId == currentWindowId) continue;
        browser.menus.create({ ...props, id: menuId, title: Metadata.getName(windowId) });
    }
    browser.menus.remove(`-${context}`); // Remove dummy if it exists
}

function openLink(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(Modifier.BRING)) WindowTab.switchWindow(windowId);
}

async function moveTab(tab, windowId, modifiers, originWindowId) {
    const tabId = tab.id;
    let tabs = await WindowTab.getSelectedTabs();
    if (tabs.length === 1) {
        // If there is no multiple tab selection, select only the target tab
        tabs = [tab];
    } else if (!tabs.some(t => t.id === tabId)) {
        // If target tab is not among the selected tabs, include it
        tabs.push(tab);
        tabs.sort((a, b) => a.index - b.index);
    }
    WindowTab.doAction({ action: 'send', windowId, originWindowId, modifiers, tabs });
}
