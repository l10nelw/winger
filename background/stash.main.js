// Module loaded only if `enable_stash=true`

import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as StashProp from './stash.prop.js';
import * as Winfo from './winfo.js';

import * as Name from '../name.js';
import * as Storage from '../storage.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').TabId} TabId */
/** @typedef {import('../types.js').BNodeId} BNodeId */
/** @typedef {import('../types.js').Window} Window */
/** @typedef {import('../types.js').Tab} Tab */
/** @typedef {import('../types.js').BNode} BNode */
/** @typedef {import('../types.js').StashFolder} StashFolder */
/** @typedef {import('../types.js').ProtoWindow} ProtoWindow */
/** @typedef {import('../types.js').ProtoTab} ProtoTab */
/** @typedef {import('../types.js').ProtoBNode} ProtoBNode */


// Ids of windows and folders currently involved in stashing/unstashing operations
/** @type {Set<WindowId | BNodeId>} */ export const nowStashing = new Set();
/** @type {Set<WindowId | BNodeId>} */ export const nowUnstashing = new Set();

/**
 * Identify the stash home's folder id based on settings.
 * @param {Object} settings
 * @param {string} settings.stash_home_root
 * @param {string} settings.stash_home_folder
 */
export async function init({ stash_home_root, stash_home_folder }) {
    /** @type {BNodeId} */ let _stashHomeId;
    if (stash_home_folder) {
        // Home is a SUBFOLDER of a root folder
        const home =
            (await getChildNodes(stash_home_root)).find(node => node.title === stash_home_folder && isFolder(node)) // Find subfolder by title
            || await createNode({ parentId: stash_home_root, title: stash_home_folder }); // Otherwise, create subfolder with title
        _stashHomeId = home.id;
    } else {
        // Home is a root folder
        _stashHomeId = stash_home_root;
    }
    Storage.set({ _stashHomeId });
}


/* --- STASH WINDOW/TABS --- */

/**
 * Turn window/tabs into folder/bookmarks.
 * Create folder if nonexistent, save tabs as bookmarks in folder. Close window if remove is true.
 * @param {WindowId} windowId
 * @param {string} name
 * @param {boolean} remove
 */
export async function stashWindow(windowId, name, remove) {
    nowStashing.add(windowId);

    /** @type {[Window, Window[], BNodeId]} */
    const [window, allWindows, homeId] = await Promise.all([
        browser.windows.get(windowId, { populate: true }),
        remove && browser.windows.getAll(),
        Storage.getValue('_stashHomeId'),
    ]);

    name = StashProp.Window.stringify(name, window);
    const folderList = await (new FolderList()).populate(homeId);
    const folder = await folderList.findBookmarklessByTitle(name) || await folderList.addNew(name);

    await handleLoneWindow(
        windowId, remove, allWindows,
        createBookmarksAtNode(window.tabs, folder, name),
        () => browser.windows.remove(windowId),
    );

    nowStashing.delete(windowId);
}

/**
 * Turn current window's selected tabs into bookmarks at targeted bookmark location or in targeted folder.
 * Close tabs if remove is true.
 * @param {BNodeId} nodeId
 * @param {boolean} remove
 */
export async function stashSelectedTabs(nodeId, remove) {
    /** @type {[Tab[], BNode]} */
    const [tabs, node] = await Promise.all([
        browser.tabs.query({ currentWindow: true }),
        getNode(nodeId),
    ]);

    const windowId = tabs[0].windowId;
    nowStashing.add(windowId);

    const selectedTabs = tabs.filter(tab => tab.highlighted);
    delete selectedTabs.find(tab => tab.active)?.active; // Avoid adding extra active tab to target stashed window

    /** @type {Window[]?} */
    const allWindows = remove && (selectedTabs.length === tabs.length) && await browser.windows.getAll();

    await handleLoneWindow(
        windowId, remove, allWindows,
        createBookmarksAtNode(selectedTabs, node),
        () => browser.tabs.remove(selectedTabs.map(tab => tab.id)),
    );

    nowStashing.delete(windowId);
}

/**
 * In case of a lone window to be closed, keep it open until stash operation is complete.
 * @param {WindowId} windowId
 * @param {boolean} remove
 * @param {Window[]?} allWindows
 * @param {Promise<BNode[]>} bookmarksPromise
 * @param {Function} closeCallback
 */
async function handleLoneWindow(windowId, remove, allWindows, bookmarksPromise, closeCallback) {
    const isLoneWindow = allWindows?.length === 1;
    if (remove) {
        // Close or minimize now for immediate visual feedback
        isLoneWindow
        ? browser.windows.update(windowId, { state: 'minimized' })
        : closeCallback();
    }
    await bookmarksPromise;
    if (remove && isLoneWindow)
        closeCallback();
}

/**
 * @param {Tab[]} tabs
 * @param {BNode} node
 * @param {string} [logName]
 * @returns {Promise<BNode[]>}
 */
async function createBookmarksAtNode(tabs, node, logName = '') {
    const isNodeFolder = isFolder(node);
    const [folder,] = await Promise.all([
        isNodeFolder ? node : getNode(node.parentId),
        StashProp.Tab.prepare(tabs),
    ]);
    const folderId = folder.id;
    nowStashing.add(folderId);

    const count = tabs.length;
    /** @type {Promise<BNode>[]} */ const creatingBookmarks = new Array(count);
    /** @type {number?} */ const index = isNodeFolder ? null : node.index;
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, index, logName);
    const bookmarks = await Promise.all(creatingBookmarks);

    nowStashing.delete(folderId);
    return bookmarks;
}

/**
 * @param {Tab} tab
 * @param {BNodeId} parentId
 * @param {number?} index
 * @param {string} logName
 * @returns {Promise<BNode>}
 */
function createBookmark(tab, parentId, index, logName) {
    const url = Auto.deplaceholderize(tab.url);
    const title = StashProp.Tab.stringify(tab, parentId) || url;
    console.log(`Stashing ${logName} | ${url} | ${title}`);
    return createNode({ parentId, url, title, index });
}


/* --- UNSTASH WINDOW/TAB --- */

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

    /** @type {[Object<string, BNode[]>, Window, boolean]} */
    const [{ bookmarks, subfolders }, window, auto_name_unstash] = await Promise.all([
        readFolder(folderId),
        browser.windows.create(protoWindow),
        Storage.getValue('auto_name_unstash'),
    ]);
    const windowId = window.id;
    nowUnstashing.add(folderId).add(windowId);

    if (auto_name_unstash)
        nameWindow(windowId, name);
    await populateWindow(window, bookmarks, name);
    nowUnstashing.delete(windowId);

    if (remove)
        subfolders.length // If folder contains subfolders
            ? await Promise.all( bookmarks.map(({ id }) => removeNode(id)) ) // remove each bookmark individually
            : await browser.bookmarks.removeTree(folderId); // else remove entire folder
    nowUnstashing.delete(folderId);
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
    Chrome.update([[windowId, name]]);
}

/**
 * @param {Window} window
 * @param {BNode[]} bookmarks
 * @param {string} logName
 */
async function populateWindow(window, bookmarks, logName) {
    if (!bookmarks.length)
        return;

    const windowId = window.id;
    const protoTabs = bookmarks.map(({ title, url }) => ({ windowId, url, ...StashProp.Tab.parse(title) }));

    await StashProp.Tab.preOpen(protoTabs, window);
    const openingTabs = protoTabs.map(protoTab => openTab(protoTab, logName));

    Promise.any(openingTabs).then(() => browser.tabs.remove(window.tabs[0].id)); // Remove initial tab
    const tabs = await Promise.all(openingTabs);
    StashProp.Tab.postOpen(tabs, protoTabs);
}

/**
 * @param {ProtoTab} protoTab
 * @param {string} [logName]
 * @returns {Promise<Tab>}
 */
function openTab(protoTab, logName = '') {
    console.log(`Unstashing ${logName} | ${protoTab.url} | ${protoTab.title}`);
    const safeProtoTab = StashProp.Tab.scrub(protoTab);
    safeProtoTab.discarded = true;
    return Action.openTab(safeProtoTab);
}


/* --- MENU HELPERS --- */

/**
 * Can tabs in given or current window be stashed at/into this node?
 * @param {BNodeId} nodeId
 * @param {WindowId?} [windowId]
 * @returns {Promise<boolean>}
 */
export async function canStashHere(nodeId, windowId = null) {
    /** @type {Set<WindowId | BNodeId>} */
    const nowProcessing = nowStashing.union(nowUnstashing);
    return !(
        nowProcessing.has(nodeId) || // Folder is being processed
        nowProcessing.has(windowId || await Storage.getValue('_focusedWindowId')) || // Window is being processed
        nowProcessing.has((await getNode(nodeId)).parentId) // Parent folder is being processed
    );
}

/**
 * Can given node be unstashed?
 * @param {BNodeId} nodeId
 * @returns {Promise<boolean>}
 */
export async function canUnstashThis(nodeId) {
    /** @type {Set<WindowId | BNodeId>} */
    const nowProcessing = nowStashing.union(nowUnstashing);
    if (isRootId(nodeId) || nowProcessing.has(nodeId))
        return false; // Disallow root folders and folders being processed
    const node = await getNode(nodeId);
    switch (node.type) {
        case 'separator':
            return false; // Disallow separators
        case 'bookmark':
            return !nowProcessing.has(node.parentId); // Allow bookmarks, unless they are inside a folder being processed
    }
    // Is folder
    const [, protoWindow] = StashProp.Window.parse(node.title);
    if (protoWindow?.incognito && !await browser.extension.isAllowedIncognitoAccess())
        return false; // Disallow private-window folders without private-window access
    return true;
}


/* --- GENERAL HELPERS --- */

/** @type {Set<BNodeId>} */ const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);
/** @param {BNodeId} nodeId @returns {boolean} */ const isRootId = nodeId => ROOT_IDS.has(nodeId);

/** @param {BNode} node @returns {boolean} */ const isSeparator = node => node.type === 'separator';
/** @param {BNode} node @returns {boolean} */ const isFolder    = node => node.type === 'folder';
/** @param {BNode} node @returns {boolean} */ const isBookmark  = node => node.type === 'bookmark';

/** @param {BNodeId} nodeId   @returns {Promise<BNode>}   */ const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0];
/** @param {BNodeId} parentId @returns {Promise<BNode[]>} */ const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);

/** @param {ProtoBNode} protoNode @returns {Promise<BNode>} */ const createNode = protoNode => browser.bookmarks.create(protoNode);
/** @param {BNodeId} nodeId       @returns {Promise<void>}  */ const removeNode = nodeId => browser.bookmarks.remove(nodeId);

export class FolderList extends Array {

    /** @type {BNodeId} */ parentId;
    hasBookmarkCount = false;

    /**
     * Populate list with valid folders by providing either: a complete `nodes` array, or just their common `parentId`.
     * If the parentId is a root id, list starts after the last separator, or add a separator if none found and the list starts empty.
     * Each child folder will have `givenName` and possible `protoWindow` property from `StashProp.Window.parse()`.
     * @param {BNode[] | BNodeId} nodes_or_parentId
     * @returns {Promise<this>}
     */
    async populate(nodes_or_parentId) {

        /** @type {BNodeId} */
        const parentId = nodes_or_parentId[0]?.parentId ?? nodes_or_parentId;
        /** @type {[StashFolder[], boolean]} */
        let [nodes, allow_private] = await Promise.all([
            Array.isArray(nodes_or_parentId) ? nodes_or_parentId : getChildNodes(parentId),
            browser.extension.isAllowedIncognitoAccess(),
        ]);

        this.parentId = parentId;
        this.length = 0;

        // If parent is a root folder and `nodes` is a complete array of children, take only `nodes` after last separator
        // If no separator found, add one at the end and empty `nodes`
        if (isRootId(parentId) && nodes[0].index === 0) {
            const lastSeparator = nodes.findLast(isSeparator);
            if (lastSeparator)
                nodes = nodes.slice(lastSeparator.index + 1);
            else {
                createNode({ type: 'separator', parentId });
                nodes = [];
            }
        }

        // Filter out invalid and non-folders
        // Parse any annotations, adding `givenName` and `protoWindow` properties
        for (const node of nodes) {
            if (!isFolder(node))
                continue; // Skip non-folder
            const [title, protoWindow] = StashProp.Window.parse(node.title);
            if (protoWindow) {
                if (protoWindow.incognito && !allow_private)
                    continue; // Skip private-window folder if no private-window access
                node.protoWindow = protoWindow;
            }
            node.givenName = title;
            this.push(node);
        }

        return this;
    }

    /**
     * Adds `bookmarkCount` property to each folder.
     * @returns {Promise<this>}
     * @this {StashFolder[]}
     */
    async countBookmarks() {
        /** "Grandchildren" @type {BNode[][]} */
        const nodeLists = await Promise.all( this.map(folder => getChildNodes(folder.id)) );
        for (let i = this.length; i--;)
            this[i].bookmarkCount = nodeLists[i].filter(isBookmark).length;
        this.hasBookmarkCount = true;
        return this;
    }

    /**
     * Find folder with the given title.
     * @param {string} title
     * @return {BNode?}
     * @this {StashFolder[]}
     */
    findByTitle(title) {
        /** @type {Set<WindowId | BNodeId>} */
        const nowProcessing = nowStashing.union(nowUnstashing);
        return this.find(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
    }

    /**
     * Find bookmarkless folder with the given `title`.
     * @param {string} title
     * @return {Promise<BNode?>}
     * @this {StashFolder[]}
     */
    async findBookmarklessByTitle(title) {
        /** @type {Set<WindowId | BNodeId>} */
        const nowProcessing = nowStashing.union(nowUnstashing);

        if (this.hasBookmarkCount)
            return this.find(folder => !nowProcessing.has(folder.id) && folder.bookmarkCount === 0 && folder.givenName === title);

        // If no `bookmarkCount`, find folders matching `title` then check for any bookmarks inside
        const folders = this.filter(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
        if (!folders.length)
            return;
        /** "Grandchildren" @type {BNode[][]} */
        const nodeLists = await Promise.all( folders.map(folder => getChildNodes(folder.id)) );
        const index = nodeLists.findIndex(nodeList => !nodeList.find(isBookmark));
        return folders[index];
    }

    /**
     * Add a new folder to the start of the folderList.
     * @param {string} title
     * @returns {Promise<BNode>}
     */
    async addNew(title) {
        const parentId = this.parentId;
        const index = this[0]?.index;
        const folder = await createNode({ title, parentId, index });
        this.unshift(folder);
        return folder;
    }
}
