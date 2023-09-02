// Automatic operations following/supporting Winger and native actions.


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
