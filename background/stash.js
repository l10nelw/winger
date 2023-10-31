import * as Name from '../name.js';
import * as Action from './action.js';
import * as Chrome from './chrome.js';
import * as Winfo from './winfo.js';

let HOME_ID;
const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);
export const nowProcessing = new Set(); // Ids of windows and folders currently involved in any stashing/unstashing operations


/* --- INIT --- */

// Identify the stash home's folder id based on settings.
//@ (Object), state -> state
export async function init(settings) {
    let rootId = settings.stash_home; // Id of a root folder; may be followed by a marker character indicating that home is a subfolder
    let nodes;
    const isRoot = isRootId(rootId);
    if (isRoot) {
        HOME_ID = rootId;
        nodes = await getChildNodes(rootId);
    } else {
        // Home is subfolder of root folder
        rootId = rootId.slice(0, -1); // Remove marker
        nodes = await getChildNodes(rootId);
        const title = settings.stash_home_name;
        const folder = findFolderByTitle(nodes, title);
        HOME_ID = folder ? folder.id : (await createFolder(title, rootId)).id;
    }
    if (isRoot && nodes.length && findSeparator(nodes) === -1) // If home is a root folder, not empty and has no separator
        createNode({ type: 'separator', parentId: HOME_ID });
}

//@ ([Object]) -> (Number)
function findSeparator(nodes) {
    for (let i = nodes.length; i--;) // Reverse iterate
        if (isSeparator(nodes[i]))
            return i;
    return -1;
}

const findFolderByTitle = (nodes, title) => nodes.find(node => node.title === title && isFolder(node)); //@ ([Object], String) -> (Object)


/* --- LIST FOLDERS --- */

export const folderMap = new Map();

//@ state -> state
folderMap.populate = async () => {
    const nodes = await getHomeContents();
    for (let i = nodes.length; i--;) { // Reverse iterate
        const node = nodes[i];
        switch (node.type) {
            case 'separator':
                return; // Stop at first separator from the end
            case 'folder':
                const { id, title } = node;
                const bookmarkCount = nowProcessing.has(id) ? 0 : node.children.filter(isBookmark).length;
                folderMap.set(id, { id, title, bookmarkCount });
        }
    }
}

const getHomeContents = async () => (await browser.bookmarks.getSubTree(HOME_ID))[0].children; //@ state -> ([Object])


/* --- STASH WINDOW --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder. Close window if remove is true.
//@ (Number, Boolean), state -> state
export async function stash(windowId, remove = true) {
    const [name, tabs] = await Promise.all([
        Name.load(windowId),
        browser.tabs.query({ windowId }),
    ]);
    if (remove)
        browser.windows.remove(windowId);
    const folderId = (await getTargetFolder(name)).id;
    nowProcessing.add(folderId);
    await saveTabs(tabs, folderId, name);
    nowProcessing.delete(folderId);
}

// For a given name, return a matching bookmarkless folder, otherwise return a new folder.
//@ (String), state -> (Object), state
async function getTargetFolder(name) {
    const isMapEmpty = !folderMap.size;
    if (isMapEmpty)
        await folderMap.populate();
    const folder = findBookmarklessFolder(name);
    if (isMapEmpty)
        folderMap.clear();
    return folder || createFolder(name);
}

//@ (String), state -> (Object)
function findBookmarklessFolder(name) {
    for (const folder of folderMap.values())
        if (folder.title === name && !folder.bookmarkCount)
            return folder;
}

//@ ([Object], Number, String), state -> state
async function saveTabs(tabs, folderId, name) {
    const count = tabs.length;
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, name);
    await Promise.all(creatingBookmarks);
}

//@ (Object, Number) -> (Object), state
async function createBookmark(tab, parentId, name) {
    const url = Action.deplaceholderize(tab.url);
    const { title } = tab;
    console.log(`Stashing ${name} | ${url} | ${title}`);
    return createNode({ parentId, url, title });
}


/* --- UNSTASH TAB/WINDOW --- */

// Turn folder/bookmarks into window/tabs. Delete folder/bookmarks if remove is true.
//@ (String, Boolean), state -> state
export async function unstash(nodeId, remove = true) {
    const node = (await browser.bookmarks.get(nodeId))[0];
    if (isBookmark(node))
        unstashSingleTab(node, remove);
    else
    if (isFolder(node))
        unstashWindow(node, remove);
}

// Unstash single bookmark to current window.
// This operation will not appear in nowProcessing.
//@ (Object, Boolean), state -> state
async function unstashSingleTab(node, remove) {
    const currentWindow = await browser.windows.getLastFocused();
    const tab = await openTab(node, currentWindow.id, true);
    browser.tabs.update(tab.id, { active: true });
    if (remove)
        removeNode(node.id);
}

//@ (Object, Boolean) -> (Object), state
async function unstashWindow(folder, remove) {
    const window = await browser.windows.create();
    const windowId = window.id;
    const folderId = folder.id;
    const name = folder.title;
    nowProcessing.add(folderId).add(windowId);
    nameWindow(windowId, name);
    populateWindow(windowId, window.tabs[0].id, folderId, name, remove);
}

//@ (Number, String) -> state
async function nameWindow(windowId, name) {
    name = Name.validify(name);
    if (name) {
        const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
        Name.save(windowId, nameMap.uniquify(name));
        Chrome.update(windowId, name);
    }
}

//@ (Number, Number, String, String, Boolean) -> state
async function populateWindow(windowId, initTabId, folderId, name, remove) {
    const { bookmarks, subfolders } = await readFolder(folderId);

    const openingTabs = bookmarks.map(bookmark => openTab(bookmark, windowId, name));
    Promise.any(openingTabs).then(() => browser.tabs.remove(initTabId));
    await Promise.all(openingTabs);
    nowProcessing.delete(windowId);

    if (remove)
        subfolders.length // If folder contains subfolders
            ? await Promise.all( bookmarks.map(bookmark => removeNode(bookmark.id)) ) // remove each bookmark individually
            : await browser.bookmarks.removeTree(folderId); // else remove entire folder
    nowProcessing.delete(folderId);
}

//@ (String), state -> (Promise: {[Object]})
async function readFolder(folderId) {
    const nodesByType = { bookmark: [], folder: [] };
    for (const node of await getChildNodes(folderId))
        nodesByType[node.type]?.push(node);
    return {
        bookmarks: nodesByType.bookmark,
        subfolders: nodesByType.folder,
    };
}

//@ ({String, String}, Number) -> (Promise: Object), state
function openTab({ url, title }, windowId, name) {
    console.log(`Unstashing ${name} | ${url} | ${title}`);
    return Action.openTab({ url, title, windowId, discarded: true });
}


/* --- */

//@ (Number), state -> (Boolean)
export const canUnstash = async nodeId =>
    !( isRootId(nodeId) || nowProcessing.has(nodeId) || isSeparator(await getNode(nodeId)) );

const isRootId    = nodeId => ROOT_IDS.has(nodeId);    //@ (Number) -> (Boolean)
const isSeparator = node => node.type === 'separator'; //@ (Object) -> (Boolean)
const isFolder    = node => node.type === 'folder';    //@ (Object) -> (Boolean)
const isBookmark  = node => node.type === 'bookmark';  //@ (Object) -> (Boolean)

const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0]; //@ (Number), state -> (Object)
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId); //@ (Number), state -> (Promise: [Object])

const createNode = properties => browser.bookmarks.create(properties); //@ (Object) -> (Promise: Object), state
const createFolder = (title, parentId = HOME_ID) => createNode({ title, parentId }); //@ (String, Number) -> (Promise: Object), state
const removeNode = nodeId => browser.bookmarks.remove(nodeId); //@ (Number) -> (Promise: Object), state
