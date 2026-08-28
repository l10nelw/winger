import { getChildNodes, getNode, nowUnstashing, removeNode } from './stash.core.js';
import * as StashProp from './stash.prop.js';

import * as Action from './action.js';
import * as Winfo from './winfo.js';
import completeUpdate from './update.js';

import * as Name from '../name.js';
import * as Storage from '../storage.js';

/** @import { WindowId, BNodeId, Window, Tab, BNode, ProtoTab } from '../types.js' */

/**
 * Turn folder/bookmarks into window/tabs. Delete folder/bookmarks if remove is true.
 * @param {BNodeId} nodeId
 * @param {boolean} [remove=true]
 */
export async function unstashNode(nodeId, remove = true) {
    const node = await getNode(nodeId);
    switch (node.type) {
        case 'bookmark':
            return unstashBookmark(node, remove);
        case 'folder':
            return unstashFolder(node, remove);
    }
}

/**
 * Unstash single bookmark to current window.
 * This operation will not appear in nowUnstashing.
 * @param {BNode} node
 * @param {boolean} remove
 */
async function unstashBookmark(node, remove) {
    /** @type {Window} */ const window = await browser.windows.getLastFocused();
    /** @type {ProtoTab} */ const protoTab = { url: node.url, windowId: window.id, ...StashProp.Tab.parse(node.title) };
    await StashProp.Tab.preOpen([protoTab], window);
    const tab = await openTab(protoTab);
    browser.tabs.update(tab.id, { active: true });
    if (remove)
        removeNode(node.id);
}

/**
 * @param {BNode} folder
 * @param {boolean} remove
 */
async function unstashFolder(folder, remove) {
    const folderId = folder.id;
    const [name, protoWindow] = StashProp.Window.parse(folder.title);
    console.info(`Unstashing folder id ${folderId}: ${name}...`);

    if (protoWindow && 'preserve' in protoWindow) {
        remove = !protoWindow.preserve;
        delete protoWindow.preserve;
    }

    const [window, { bookmarks, subfolders }, unstash_auto_name] = await Promise.all([
        /** @type {Promise<Window>} */ (browser.windows.create(protoWindow)),
        readFolder(folderId),
        Storage.getValue('unstash_auto_name'),
    ]);
    const windowId = window.id;
    nowUnstashing.add(folderId).add(windowId);

    if (unstash_auto_name)
        nameWindow(windowId, name);
    await populateWindow(window, bookmarks, name);
    nowUnstashing.delete(windowId);

    if (remove)
        subfolders.length // If folder contains subfolders
            ? await Promise.all(bookmarks.map(({ id }) => removeNode(id))) // remove each bookmark individually
            : await browser.bookmarks.removeTree(folderId); // else remove entire folder
    nowUnstashing.delete(folderId);
    console.info(`... Done unstashing folder id ${folderId} to window id ${windowId}: "${name || '(no title)'}"`);
}

/**
 * @param {BNodeId} folderId
 * @returns {Promise<{ bookmarks: BNode[], subfolders: BNode[] }>}
 */
async function readFolder(folderId) {
    /** @type {{ bookmark: BNode[], folder: BNode[] }} */
    const nodesByType = { bookmark: [], folder: [] };
    for (const node of await getChildNodes(folderId))
        nodesByType[node.type]?.push(node);
    return {
        bookmarks: nodesByType.bookmark,
        subfolders: nodesByType.folder,
    };
}

/**
 * @param {WindowId} windowId
 * @param {string} name
 */
async function nameWindow(windowId, name) {
    name = Name.validify(name);
    if (!name)
        return;
    const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
    name = nameMap.uniquify(name);
    Name.save(windowId, name);
    completeUpdate([[windowId, name]], 'system');
}

/**
 * @param {Window} window
 * @param {BNode[]} bookmarks
 */
async function populateWindow(window, bookmarks) {
    if (!bookmarks.length)
        return;

    const windowId = window.id;
    /** @type {ProtoTab[]} */
    const protoTabs = bookmarks.map(({ title, url }) => ({ windowId, url, ...StashProp.Tab.parse(title) }));

    await StashProp.Tab.preOpen(protoTabs, window);
    const openingTabs = protoTabs.map(openTab);
    Promise.any(openingTabs).then(() => browser.tabs.remove(window.tabs[0].id)); // Remove the initial tab that came with the new window
    const tabs = await Promise.all(openingTabs);
    StashProp.Tab.postOpen(tabs, protoTabs);
}

/**
 * @param {ProtoTab} protoTab
 * @returns {Promise<Tab>}
 */
async function openTab(protoTab) {
    const safeProtoTab = StashProp.Tab.scrub(protoTab);
    safeProtoTab.discarded = true;
    const tab = await Action.openTab(safeProtoTab);
    console.info(`Unstashed tab id ${tab.id}: ${tab.url} | ${tab.title}`);
    return tab;
}
