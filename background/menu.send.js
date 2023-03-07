import { BRING } from '../modifier.js';
import { NO_NAME } from '../name.js';
import * as Winfo from './winfo.js';
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

//@ ([String], [String]) -> (Boolean)
const isIntersect = (array1, array2) => array1.some(item => array2.includes(item));

// Event handler: When menu shown and there is more than one window, enable menu and populate submenu.
//@ (Object, Object) -> (Boolean), state|nil
export async function handleShow(info, tab) {
    if (!isIntersect(info.contexts, contexts))
        return false;
    const windows = await browser.windows.getAll();
    if (windows.length > 1) {
        await populate(windows);
        browser.menus.update(parentId, { enabled: true });
        browser.menus.refresh();
    }
    return true;
}

// Clear submenu and populate with sorted other-windows.
// Submenu item ids are window ids.
//@ ([Object]) -> state
async function populate(windows) {
    const { currentWinfo, otherWinfos } = Winfo.arrange(
        await Winfo.getAll(['focused', 'givenName', 'lastFocused', 'minimized'], windows)
    );
    for (let { id, givenName } of otherWinfos) {
        const title = givenName || NO_NAME;
        id = `${id}`; // Menu id must be string
        browser.menus.remove(id);
        browser.menus.create({ parentId, id, title });
    }
    browser.menus.remove(`${currentWinfo.id}`);
    browser.menus.remove(dummyId);
}

// Event handler: When menu closes, re-disable menu item.
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
        Action.switchWindow({ windowId });
}

// Move target tab to windowId. If target tab is a selected tab, move any other selected tabs as well.
//@ (Object, Number, [String]) -> state
function moveTab(tab, windowId, modifiers) {
    const tabs = tab.highlighted ? null : [tab];
    Action.execute({ action: 'send', tabs, windowId, modifiers });
}
