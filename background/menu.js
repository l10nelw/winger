// "Send to Window" menu

import * as Action from './action.js';
import * as Winfo from './winfo.js';

import { BRING, modify } from '../modifier.js';

/** @import { WindowId, Window, Tab, Winfo, ActionRequest } from '../types.js' */

const parentId = 'send';
const dummyId = '-';
const contexts = ['tab', 'link'];

export function init() {
    // Parent menu item
    browser.menus.create({
        contexts,
        id: parentId,
        title: 'Send to &Window',
        enabled: false, // Disabled state as baseline
    });
    // Dummy submenu item to avoid the parent menu item resizing upon first-time population
    browser.menus.create({
        parentId,
        id: dummyId,
        title: dummyId,
    });
}

/**
 * Event handler: When menu shown and there is more than one window, enable menu and populate submenu.
 * @listens browser.menus.onShown
 * @param {Object} info
 * @param {string[]} info.contexts
 * @returns {Promise<boolean>}
 */
export async function handleShow(info) {
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

/**
 * Check if two arrays have at least one common item.
 * @param {any[]} array1
 * @param {any[]} array2
 * @returns {boolean}
 */
const isIntersect = (array1, array2) => array1.some(item => array2.includes(item));

/**
 * Clear submenu and populate with sorted background windows.
 * Submenu item ids are window ids.
 * @param {Window[]} windows
 */
async function populate(windows) {
    const doNothing = () => {};
    const privateIcon = { 16: 'icons/private.svg' };
    const { fgWinfo, bgWinfos } = Winfo.arrange(
        await Winfo.getAll(['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'titleSansName'], windows)
    );
    let hasMinimizedSeparator = false;

    browser.menus.remove('minimized').catch(doNothing);
    browser.menus.remove(`${fgWinfo.id}`).catch(doNothing);

    for (let { id, givenName, incognito, minimized, titleSansName } of bgWinfos) {
        if (minimized && !hasMinimizedSeparator) {
            browser.menus.create({ parentId, id: 'minimized', type: 'separator' });
            hasMinimizedSeparator = true;
        }
        id = /** @type {string} */ (`${id}`); // Menu id must be string
        const title = givenName || titleSansName || '-';
        const menuToCreate = { parentId, id, title };
        if (incognito)
            menuToCreate.icons = privateIcon;
        browser.menus.remove(id).catch(doNothing);
        browser.menus.create(menuToCreate);
    }

    browser.menus.remove(dummyId).catch(doNothing);
}

/**
 * Event handler: When menu closes, re-disable menu item.
 * @listens browser.menus.onHidden
 */
export function handleHide() {
    browser.menus.update(parentId, { enabled: false });
}

/**
 * Event handler: Invoke submenu item click response based on context.
 * @listens browser.menus.onClicked
 * @param {Object} info
 * @param {string} info.menuItemId
 * @param {string[]} info.modifiers
 * @param {string} [info.linkUrl]
 * @param {Tab} tab
 * @returns {boolean}
 */
export function handleClick(info, tab) {
    const windowId = +info.menuItemId;
    if (windowId) {
        const url = info.linkUrl;
        url ? openLink (url, windowId, info.modifiers)
            : moveTab  (tab, windowId, info.modifiers);
        return true;
    }
}

/**
 * Open url at windowId.
 * @param {string} url
 * @param {WindowId} windowId
 * @param {string[]} modifiers
 */
function openLink(url, windowId, modifiers) {
    browser.tabs.create({ windowId, url });
    if (modifiers.includes(BRING))
        Action.switchWindow({ windowId });
}

/**
 * Move target tab to windowId. If target tab is a selected tab, move any other selected tabs as well.
 * @param {Tab} tab
 * @param {WindowId} windowId
 * @param {string[]} modifiers
 */
function moveTab(tab, windowId, modifiers) {
    /** @type {ActionRequest} */
    const request = {
        action: modify('send', modifiers),
        tabs: tab.highlighted ? null : [tab], // tabs=null means all selected tabs
        windowId,
    };
    Action.execute(request);
}
