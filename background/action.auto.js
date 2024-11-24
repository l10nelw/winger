// Automatic operations that follow or support Winger and native actions

import * as Storage from '../storage.js';

// Open extension page tab, closing any duplicates found.
//@ (String, String), state -> state
export async function openUniquePage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const tabsToClose = await browser.tabs.query({ url });
    if (hash)
        pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
    browser.tabs.remove(tabsToClose.map(tab => tab.id));
}

// Given `referenceTabs` with parent-child relationships, and same-length `tabs` with none, restore the same relationships within `tabs` (note: not mutated).
// Ignore parent tabs that are not within `referenceTabs`.
// If `tabs` was the result of a move, and therefore same as pre-move `referenceTabs` (same ids) minus relationships, `isMove` must be true.
// Otherwise if `referenceTabs` have ids (e.g. reopened tabs, protoTabs, etc), they must not repeat any tab ids of the current session.
//@ ([Object], [Object], Boolean|undefined) -> state
export function restoreTabRelations(tabs, referenceTabs, isMove = false) {
    if (tabs.length !== referenceTabs.length)
        throw 'restoreTabRelations: The two tab arrays do not match in length';
    if (isMove) {
        for (const { id, openerTabId } of referenceTabs)
            if (openerTabId)
                browser.tabs.update(id, { openerTabId });
        return;
    }
    const referenceMap = new Map();
    referenceTabs.forEach(({ id, openerTabId }, index) => {
        id ??= tabs[index].id; // If no reference id (e.g. id-less protoTab), just use the corresponding tab id
        if (referenceMap.has(id))
            throw 'restoreTabRelations: The two tab arrays contain a repeating id';
        // Maps have no indexes like arrays, so we explicitly store them; they will tell us where parent tabs are
        referenceMap.set(id, { index, openerTabId });
    });
    for (const { index, openerTabId } of referenceMap.values()) {
        if (openerTabId && referenceMap.has(openerTabId)) { // This referenceTab has a parent within referenceTabs
            const parentIndex = referenceMap.get(openerTabId).index;
            browser.tabs.update(tabs[index].id, { openerTabId: tabs[parentIndex].id });
        }
    }
}

// Re-discard discarded tabs.
// To work around a rare issue where, for some reason, discarded tabs sometimes reload when moved.
//@ ([Object]) -> state
export function assertDiscard(tabs) {
    const tabIds = [];
    for (const tab of tabs)
        if (tab.discarded)
            tabIds.push(tab.id);
    if (tabIds.length)
        browser.tabs.discard(tabIds);
}


/* --- Placeholder tab --- */

//@ (Object, String) -> (Promise: Object), state
export function openPlaceholder(protoTab, title) {
    const url = protoTab.url;
    protoTab.url = buildPlaceholderURL(url, title || url);
    return browser.tabs.create(protoTab);
}

//@ (String) -> (String)
export function deplaceholderize(url) {
    return isPlaceholder(url) ?
        getUrlParam(url) : url;
}

const PLACEHOLDER_PAGE = '../page/placeholder.html';
const buildPlaceholderURL = (url, title) => `${PLACEHOLDER_PAGE}?${new URLSearchParams({ url, title })}`; //@ (String, String) -> (String)
const isPlaceholder = url => url.startsWith(browser.runtime.getURL(PLACEHOLDER_PAGE)); //@ (String) -> (Boolean)
const getUrlParam = originalUrl => (new URL(originalUrl)).searchParams.get('url'); //@ (String) -> (String)


/* --- Background windows management --- */

export const discardWindow = {
    //@ (Number) -> state
    async schedule(windowId) {
        const delayInMinutes = await Storage.getValue('discard_minimized_window_delay_mins');
        delayInMinutes
        ? browser.alarms.create(`discardWindow-${windowId}`, { delayInMinutes })
        : discardWindow.now(windowId);
    },
    deschedule(windowId) {
        browser.alarms.clear(`discardWindow-${windowId}`);
    },
    async now(windowId) {
        const tabs = await browser.tabs.query({ windowId, active: false, discarded: false });
        browser.tabs.discard(tabs.map(tab => tab.id));
    },
}
