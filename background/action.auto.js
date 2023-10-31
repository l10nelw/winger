// Automatic operations following/supporting Winger and native actions.

import * as Settings from '../settings.js';
import * as Action from './action.js';


// Open extension page tab, closing any duplicates found.
//@ (String, String), state -> state
export async function openUniquePage(pathname, hash) {
    const url = browser.runtime.getURL(pathname);
    const openedTabs = await browser.tabs.query({ url });
    if (hash)
        pathname += hash;
    browser.tabs.create({ url: `/${pathname}` });
    browser.tabs.remove(openedTabs.map(tab => tab.id));
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

//@ (Number) -> state
export async function unloadWindow(windowId) {
    const tabs = await browser.tabs.query({ windowId, active: false, discarded: false });
    unloadTabs(tabs);
}

export const unloadTabs = tabs => browser.tabs.discard(tabs.map(tab => tab.id)); //@ ([Object]) -> state

// If window minimized or delay 0, plug window immediately and return blank tab. Otherwise, schedule plugging and return alarm.
//@ (Number, Boolean), state -> (Object), state
export async function schedulePlugWindow(windowId, minimized) {
    if (!minimized) {
        const delayInMinutes = await Settings.getValue('plug_unfocused_window_delay_mins');
        if (delayInMinutes)
            return browser.alarms.create(`plugWindow-${windowId}`, { delayInMinutes });
    }
    return plugWindow(windowId);
}

//@ (Number) -> state
export async function deschedulePlugWindow(windowId) {
    browser.alarms.clear(`plugWindow-${windowId}`);
}

// If focused tab is discardable, add a focused blank tab to defocus it, allowing it to be discarded.
// This ("plugging the leak") allows the window to be fully discarded.
//@ (Number) -> (Object), state | (undefined)
export async function plugWindow(windowId) {
    const selectedTabs = await getSelectedTabs(windowId);
    const focusedTab = selectedTabs.find(tab => tab.active);
    if (!isDiscardable(focusedTab))
        return;
    const blankTab = await browser.tabs.create({ url: 'about:blank', windowId, index: focusedTab.index + 1, pinned: focusedTab.pinned });
    browser.tabs.moveInSuccession([blankTab.id], focusedTab.id); // When blankTab is closed, focusedTab will be focused next

    if (selectedTabs.length > 1)
        selectedTabs.forEach(tab => Action.selectTab(tab.id));
    return blankTab;
}

// Remove blank tabs from window, if any.
//@ (Number) -> state
export async function unplugWindow(windowId) {
    const [blankTabs, selectedTabs] = await Promise.all([ getBlankTabs(windowId), getSelectedTabs(windowId) ]) ;
    if (!blankTabs.length)
        return;
    const blankTabIds = blankTabs.map(tab => tab.id);
    await browser.tabs.remove(blankTabIds);

    for (const { id, active } of selectedTabs)
        if (!active && !blankTabIds.includes(id))
            Action.selectTab(id);
}

const getSelectedTabs = windowId => browser.tabs.query({ windowId, highlighted: true }); //@ (Number) -> ([Object])
// Check title also because all tabs initialise as about:blank
export const getBlankTabs = windowId => browser.tabs.query({ url: 'about:blank', title: 'New Tab', windowId }); //@ (Number) -> ([Object])

const NON_DISCARD_SCHEMES = ['about:', 'moz-extension:', 'file:', 'data:', 'chrome:'];
//@ (Object) -> (Boolean)
const isDiscardable = ({ autoDiscardable, audible, url }) =>
    autoDiscardable && !audible && !NON_DISCARD_SCHEMES.some(scheme => url.startsWith(scheme));