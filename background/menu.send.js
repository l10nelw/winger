import { BRING } from '../modifier.js';
import { get as getName } from './name.js';
import * as Window from './window.js';
import * as Action from './action.js';

const parentId = 'send';
const dummyId = '-';
const contexts = ['tab', 'link'];

// Add menu item
browser.menus.create({
    contexts,
    id: parentId,
    title: 'Send to &Window',
    enabled: false, // Disabled state as baseline
});
// Add dummy submenu item to avoid the menu item resizing upon first-time population
browser.menus.create({
    parentId,
    id: dummyId,
    title: dummyId,
});

//@ ([String], [String]) -> Boolean
const isIntersect = (array1, array2) => array1.some(item => array2.includes(item));

// Event handler: Enable menu and populate submenu if there is more than one window, when menu shown.
//@ (Object, Object) -> (Boolean), state|nil
export function handleShow(info, tab) {
    if (isIntersect(info.contexts, contexts) && Window.isOverOne()) {
        populate(tab.windowId);
        browser.menus.update(parentId, { enabled: true });
        browser.menus.refresh();
        return true;
    }
}

// Clear submenu and populate with other-windows, sorted by lastFocsued.
// Submenu item ids are window ids.
//@ (Number), state -> state
function populate(currentWindowId) {
    for (let { id } of Window.sortedWinfos()) {
        id = String(id);
        browser.menus.remove(id);
        if (id != currentWindowId)
            browser.menus.create({ parentId, id, title: getName(id) });
    }
    browser.menus.remove(dummyId);
}

// Event handler: Re-disable menu item when menu disappears.
//@ -> state
export function handleHide() {
    browser.menus.update(parentId, { enabled: false });
}

// Event handler: Invoke submenu item click response based on context.
//@ (Object, Object) -> (Boolean), state|nil
export function handleClick(info, tab) {
    const windowId = Number(info.menuItemId);
    if (windowId) {
        const url = info.linkUrl;
        url ? openLink (url, windowId, info.modifiers)
            : moveTab  (tab, windowId, info.modifiers);
        return true;
    }
}

// Open url at windowId.
//@ (String, Number, [String]) -> state
function openLink(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(BRING))
        Action.switchWindow(windowId);
}

// Move target tab to windowId.
// If target tab is a selected tab, move other selected tabs as well.
//@ (Object, Number, [String]) -> state
async function moveTab(tab, windowId, modifiers) {
    const tabs = tab.highlighted ? await Action.getSelectedTabs() : [tab];
    Action.execute({ action: 'send', tabs, windowId, modifiers });
}
