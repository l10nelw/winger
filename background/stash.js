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
/** @typedef {import('../types.js').ProtoWindow} ProtoWindow */
/** @typedef {import('../types.js').ProtoTab} ProtoTab */
/** @typedef {import('../types.js').ProtoBNode} ProtoBNode */


// Ids of windows and folders currently involved in stashing/unstashing operations
/** @type {Set<WindowId | BNodeId>} */ export const nowStashing = new Set();
/** @type {Set<WindowId | BNodeId>} */ export const nowUnstashing = new Set();


/* --- INIT --- */

/**
 * Identify the stash home's folder id based on settings.
 * @param {Object} config
 * @param {boolean} config.enable_stash
 * @param {string} config.stash_home_root
 * @param {string} config.stash_home_folder
 */
export async function init({ enable_stash, stash_home_root, stash_home_folder }) {
    if (!enable_stash)
        return;
    if (stash_home_folder) {
        // Home is a subfolder of a root folder
        const folder = await getAvailableFolder(stash_home_folder, true, stash_home_root);
        Storage.set({ _stash_home_id: folder.id });
        return;
    }
    // Home is a root folder
    Storage.set({ _stash_home_id: stash_home_root });
    // If home has no separator, add one
    if (!(await getChildNodes(stash_home_root)).find(isSeparator))
        createNode({ type: 'separator', parentId: stash_home_root });
}


/* --- LIST FOLDERS --- */

export class FolderList extends Array {

    /**
     * Fill folderList with child folders of `parentId`.
     * Each child folder will have `givenName` and possible `protoWindow` properties from `StashProp.Window.parse()`.
     * Optional: boolean dict `config` for enabling these properties:
     *  - `children`=true: Add an array of child nodes to each folder
     *  - `bookmarkCount`=true: Add a bookmark count property to each folder
     * Optional: already-procured child `nodes` of parentId can be supplied for efficiency.
     * @param {BNodeId} parentId
     * @param {Object} [config]
     * @param {boolean} [config.children]
     * @param {boolean} [config.bookmarkCount]
     * @param {BNode[]} [nodes]
     * @returns {Promise<BNode[]>}
     */
    async populate(parentId, config = {}, nodes = null) {
        this.length = 0;
        this.parentId = parentId;
        let allow_private = false;
        [nodes, allow_private] = await Promise.all([
            nodes ?? getChildNodes(parentId),
            browser.extension.isAllowedIncognitoAccess(),
        ]);

        // If parent is a root folder, take only nodes after last separator
        if (ROOT_IDS.has(parentId))
            nodes = nodes.slice(nodes.findLastIndex(isSeparator) + 1);

        // Filter out non- and invalid folders, parsing any annotations
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

        // Add folder content related properties if desired
        const { children, bookmarkCount } = config;
        if (children || bookmarkCount) {
            /** @type {BNode[][]} */
            const nodeLists = await Promise.all( this.map(folder => getChildNodes(folder.id)) );
            for (let i = this.length; i--;) {
                const nodeList = nodeLists[i];
                if (children)
                    this[i].children = nodeList;
                if (bookmarkCount)
                    this[i].bookmarkCount = nodeList.filter(isBookmark).length;
            }
        }

        return this;
    }

    /**
     * Find folder with the given title and whether bookmarks are allowed.
     * @param {string} title
     * @param {boolean} canContainBookmarks
     * @return {Promise<BNode?>}
     */
    async findByTitle(title, canContainBookmarks) {
        /** @type {Set<WindowId | BNodeId>} */
        const nowProcessing = nowStashing.union(nowUnstashing);
        if (canContainBookmarks)
            return this.find(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
        // Find bookmarkless folder
        /** @type {BNode[]} */
        const folders = this.filter(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
        if (!folders.length)
            return;
        /** @type {BNode[][]} */
        const nodeLists = folders[0].children ?
            folders.map(folder => folder.children) :
            await Promise.all( folders.map(folder => getChildNodes(folder.id)) );
        /** @type {number} */
        const index = nodeLists.findIndex(nodeList => !nodeList.find(isBookmark));
        return folders[index];
    }

    /**
     * Add a new folder to the start of the folderList.
     * @param {string} title
     * @returns {Promise<BNode>}
     */
    async add(title) {
        const parentId = this.parentId;
        const index = this[0]?.index;
        const folder = await createNode({ title, parentId, index });
        if (this[0]?.children)
            folder.children = [];
        this.push(folder);
        return folder;
    }
}

/**
 * Find folder matching `title` and `parentId` parameters and `canContainBookmarks` condition, otherwise create a new one.
 * Can optionally supply already-procured children-of-parentId `nodes` for performance.
 * @param {string} title
 * @param {boolean} canContainBookmarks
 * @param {BNodeId} parentId
 * @param {BNode[]?} [nodes]
 * @returns {Promise<BNode>}
 */
async function getAvailableFolder(title, canContainBookmarks, parentId, nodes = null) {
    const folders = await (new FolderList()).populate(parentId, {}, nodes);
    return await folders.findByTitle(title, canContainBookmarks) || await folders.add(title);
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
        Storage.getValue('_stash_home_id'),
    ]);

    name = StashProp.Window.stringify(name, window);
    const folder = await getAvailableFolder(name, false, homeId); // Find bookmarkless folder, or create one

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
    /** @type {number} */ const index = isNodeFolder ? null : node.index;
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
    /** @type {BNode} */
    const node = (await browser.bookmarks.get(nodeId))[0];
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
    const [name, protoWindow] = StashProp.Window.parse(folder.title);
    /** @type {[Window, boolean]} */
    const [window, auto_name_unstash] = await Promise.all([
        browser.windows.create(protoWindow),
        Storage.getValue('auto_name_unstash'),
    ]);
    const folderId = folder.id;
    const windowId = window.id;
    nowUnstashing.add(folderId).add(windowId); // To be removed in populateWindow()
    if (auto_name_unstash)
        nameWindow(windowId, name);
    populateWindow(window, folderId, name, remove);
}

/**
 * @param {WndowId} windowId
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
 * @param {BNodeId} folderId
 * @param {string} logName
 * @param {boolean} remove
 */
async function populateWindow(window, folderId, logName, remove) {
    const windowId = window.id;
    const { bookmarks, subfolders } = await readFolder(folderId);

    if (bookmarks.length) {
        const protoTabs = bookmarks.map(({ title, url }) => ({ windowId, url, ...StashProp.Tab.parse(title) }));
        await StashProp.Tab.preOpen(protoTabs, window);
        /** @type {Promise<Tab>[]} */
        const openingTabs = protoTabs.map(protoTab => openTab(protoTab, logName));

        Promise.any(openingTabs).then(() => browser.tabs.remove(window.tabs[0].id)); // Remove initial tab
        const tabs = await Promise.all(openingTabs);
        StashProp.Tab.postOpen(tabs, protoTabs);
    }
    nowUnstashing.delete(windowId);

    if (remove)
        subfolders.length // If folder contains subfolders
        ? await Promise.all( bookmarks.map(bookmark => removeNode(bookmark.id)) ) // remove each bookmark individually
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
        nowProcessing.has(windowId || await Storage.getValue('_focused_window_id')) || // Window is being processed
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
    if (ROOT_IDS.has(nodeId) || nowProcessing.has(nodeId)) // Is root folder, or folder is being processed
        return false;
    /** @type {[BNode, boolean]} */
    const [node, allow_private] = await Promise.all([ getNode(nodeId), Storage.getValue('allow_private') ]);
    if (isSeparator(node) || nowProcessing.has(node.parentId)) // Is separator, or parent folder is being processed
        return false;
    /** @type {[BNode, boolean]} */

    const [, protoWindow] = StashProp.Window.parse(node.title);
    if (protoWindow?.incognito && !allow_private) // Is private-window folder but no private-window access
        return false;
    return true;
}


/* --- */

/** @type {Set<BNodeId>} */ const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);

/** @param {BNode} node @returns {boolean} */ const isSeparator = node => node.type === 'separator';
/** @param {BNode} node @returns {boolean} */ const isFolder    = node => node.type === 'folder';
/** @param {BNode} node @returns {boolean} */ const isBookmark  = node => node.type === 'bookmark';

/** @param {BNodeId} nodeId   @returns {Promise<BNode>}   */ const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0];
/** @param {BNodeId} parentId @returns {Promise<BNode[]>} */ const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);

/** @param {ProtoBNode} protoNode @returns {Promise<BNode>} */ const createNode = protoNode => browser.bookmarks.create(protoNode);
/** @param {BNodeId} nodeId       @returns {Promise<void>}  */ const removeNode = nodeId => browser.bookmarks.remove(nodeId);
