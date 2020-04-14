import { SETTINGS } from './settings.js';

const unpinTab    = tabId => browser.tabs.update(tabId, { pinned: false });
const pinTab      = tabId => browser.tabs.update(tabId, { pinned: true });
const activateTab = tabId => browser.tabs.update(tabId, { active: true });
const selectTab   = tabId => browser.tabs.update(tabId, { active: false, highlighted: true });
const getUrlFromReader = readerUrl => decodeURIComponent(readerUrl.slice(readerUrl.indexOf('=') + 1));

export const openHelp = () => openExtPage('help/help.html');
export const getSelectedTabs = async () => await browser.tabs.query({ currentWindow: true, highlighted: true });
export const switchWindow = windowId => browser.windows.update(windowId, { focused: true });
const actionFunctions = { bringTabs, sendTabs, switchWindow };

// Open extension page or switch to tab if already open
async function openExtPage(pathname) {
    const url = browser.runtime.getURL(pathname);
    const openedPages = await browser.tabs.query({ url });
    if (openedPages.length) {
        const tab = openedPages[0];
        browser.tabs.update(tab.id, { active: true });
        browser.windows.update(tab.windowId, { focused: true });
    } else {
        browser.tabs.create({ url: `/${pathname}` });
    }
}

// Select actionFunction to execute based on `action` and optionally `reopen` and `modifiers`, given `windowId`.
export async function doAction({ action, windowId, tabs, reopen, modifiers }) {
    tabs = tabs || await getSelectedTabs();
    action = modifyAction(action, modifiers);
    actionFunctions[action](windowId, tabs, reopen);
}

function modifyAction(action, modifiers) {
    if (!modifiers.length) return action;
    return modifiers.includes(SETTINGS.bring_modifier) ? 'bringTabs' :
           modifiers.includes(SETTINGS.send_modifier)  ? 'sendTabs' :
           action;
}

async function bringTabs(windowId, tabs, reopen) {
    if (await sendTabs(windowId, tabs, reopen)) {
        switchWindow(windowId);
    }
}

async function sendTabs(windowId, tabs, reopen) {
    const tabAction = reopen ? reopenTabs : moveTabs;
    return await tabAction(windowId, tabs);
}

async function moveTabs(windowId, tabs) {
    let pinnedTabIds;
    if (SETTINGS.move_pinned_tabs) {
        pinnedTabIds = tabs.filter(tab => tab.pinned).map(tab => tab.id);
        await Promise.all(pinnedTabIds.map(unpinTab));
    }

    const tabIds = tabs.map(tab => tab.id);
    const movedTabs = await browser.tabs.move(tabIds, { windowId, index: -1 });
    if (!movedTabs.length) return;

    if (pinnedTabIds) pinnedTabIds.forEach(pinTab);

    if (SETTINGS.keep_moved_active_tab_active) {
        const activeTab = tabs.find(tab => tab.active);
        if (activeTab) activateTab(activeTab.id);
    }
    if (SETTINGS.keep_moved_tabs_selected) {
        tabIds.forEach(selectTab);
    }
    return movedTabs;
}

async function reopenTabs(windowId, tabs) {
    if (!SETTINGS.move_pinned_tabs) {
        tabs = tabs.filter(tab => !tab.pinned);
    }

    async function reopenTab(tab) {
        const url = tab.isInReaderMode ? getUrlFromReader(tab.url) : tab.url;
        const newTab = await browser.tabs.create({
            windowId,
            url,
            pinned: tab.pinned,
            active: SETTINGS.keep_moved_active_tab_active ? tab.active : null,
            discarded: tab.discarded,
            title: tab.discarded ? tab.title : null,
            openInReaderMode: tab.isInReaderMode,
        }).catch(() => null);
        if (newTab) browser.tabs.remove(tab.id);
        return newTab;
    }
    tabs = (await Promise.all(tabs.map(reopenTab))).filter(tab => tab);
    if (!tabs.length) return;

    if (SETTINGS.keep_moved_tabs_selected) {
        tabs.forEach(tab => { if (!tab.active) selectTab(tab.id) });
    }
    return tabs;
}
