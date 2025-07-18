import { STASHCOPY } from '../modifier.js';
import { getSelectedTabs } from './action.js';
import * as Stash from './stash.js';
import * as Storage from '../storage.js';

const contexts = ['bookmark']; // Menu only appears if bookmarks permission granted
const parentId = 'bookmark';
const menuBase = { contexts, parentId, enabled: false }; // Start out disabled
const unstashMenu = { ...menuBase, id: 'unstash', title: '&Unstash', icons: { 16: 'icons/unstash.svg' } };
const stashMenu = { ...menuBase, id: 'stash', title: '&Send Tab Here', icons: { 16: 'icons/send.svg' } };

//@ -> state
export function init() {
    browser.menus.create({ contexts, id: parentId, title: '&Winger' });
    browser.menus.create(stashMenu);
    browser.menus.create({ contexts, parentId, type: 'separator' });
    browser.menus.create(unstashMenu);
}

// Event handler: When menu opens, check if menu items can be enabled for target.
//@ (Object) -> (Boolean), state|nil
export async function handleShow({ bookmarkId }) {
    if (!bookmarkId)
        return false;
    if (await Storage.getValue('enable_stash')) {
        const [canStash, canUnstash] = await Promise.all([Stash.canStashHere(bookmarkId), Stash.canUnstashThis(bookmarkId)]);
        if (canStash) {
            browser.menus.update('stash', { enabled: true });
            const tabs = await getSelectedTabs();
            const count = tabs.length;
            if (count > 1)
                browser.menus.update('stash', { title: stashMenu.title.replace('Tab', `${count} Tabs`) });
        }
        if (canUnstash)
            browser.menus.update('unstash', { enabled: true });
        if (canStash || canUnstash)
            browser.menus.refresh();
    }
    return true; // Is handled as long as target is bookmark
}

// Event handler: When menu closes, reset menu items.
//@ -> state
export function handleHide() {
    browser.menus.update('stash', { enabled: false, title: stashMenu.title });
    browser.menus.update('unstash', { enabled: false });
}

// Event handler: Invoke command on target.
//@ (Object) -> (Boolean), state|nil
export async function handleClick({ bookmarkId, menuItemId, modifiers }) {
    if (!bookmarkId)
        return false;
    const remove = !modifiers.includes(STASHCOPY);
    switch (menuItemId) {
        case 'stash':
            Stash.stashSelectedTabs(bookmarkId, remove);
            break;
        case 'unstash':
            Stash.unstashNode(bookmarkId, remove);
            break;
    }
    return true; // Is handled as long as target is bookmark
}
