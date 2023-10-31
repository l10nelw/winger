import * as Name from '../name.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Winfo from './winfo.js';
import * as State from './stash.state.js';

export const nowProcessing = new Set(); // Ids of windows and folders currently involved in any stashing/unstashing operations

const HomeId = {
    set: nodeId => browser.storage.session.set({ stashHomeId: nodeId }),
    get: async () => (await browser.storage.session.get('stashHomeId')).stashHomeId,
}

/* --- INIT --- */

// Identify the stash home's folder id based on settings.
//@ (Object), state -> state
export async function init({ enable_stash, stash_home_root, stash_home_folder }) {
    if (!enable_stash)
        return;
    const nodes = await getChildNodes(stash_home_root);
    if (stash_home_folder) {
        // Home is a subfolder of a root folder
        const folder = findFolderByTitle(nodes, stash_home_folder) || await createFolder(stash_home_folder, stash_home_root);
        HomeId.set(folder.id);
    } else {
        // Home is a root folder
        HomeId.set(stash_home_root);
        if (!nodes.findLast(isSeparator)) // If home has no separator
            createNode({ type: 'separator', parentId: stash_home_root });
    }
}

//@ ([Object], String) -> (Object)
const findFolderByTitle = (nodes, title) => nodes.find(node => isFolder(node) && node.title === title);


/* --- LIST FOLDERS --- */

export const folderMap = new Map();

//@ state -> state
folderMap.populate = async () => {
    const nodes = (await browser.bookmarks.getSubTree(await HomeId.get()))[0].children;
    for (let i = nodes.length; i--;) { // Reverse iterate
        const node = nodes[i];
        switch (node.type) {
            case 'separator':
                return; // Stop at first separator from the end
            case 'folder':
                const { id, title } = node;
                const bookmarkCount = nowProcessing.has(id) ? 0
                    : node.children.filter(isBookmark).length;
                folderMap.set(id, { id, title, bookmarkCount });
        }
    }
}
//@ (String), state -> (Object)
folderMap.findBookmarkless = title => {
    for (const folder of folderMap.values())
        if (!folder.bookmarkCount && folder.title === title)
            return folder;
}


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
//@ (String), state -> (Promise: Object), state
async function getTargetFolder(name) {
    await folderMap.populate();
    const folder = folderMap.findBookmarkless(name) || createFolder(name, await HomeId.get());
    folderMap.clear();
    return folder;
}

//@ ([Object], Number, String), state -> (Promise: [Object]) state
async function saveTabs(tabs, folderId, name) {
    const count = tabs.length;
    let containerDict;
    if (await Settings.getValue('stash_state')) {
        (new State.StashingTabMap()).populate(tabs).markParents();
        console.log(tabs);
        containerDict = await State.Containers.getDict(tabs);
    }
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, name, containerDict);
    return Promise.all(creatingBookmarks);
}

//@ (Object, Number, String, Object) -> (Object), state
async function createBookmark(tab, parentId, name, containerDict) {
    const url = Auto.deplaceholderize(tab.url);
    const title = State.Tab.stringify(tab, parentId, containerDict);
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
    const name = folder.title;
    nameWindow(windowId, name);
    populateWindow(windowId, window.tabs[0].id, folder.id, name, remove);
}

//@ (Number, String) -> state
async function nameWindow(windowId, name) {
    name = Name.validify(name);
    if (name) {
        const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
        Name.save(windowId, nameMap.uniquify(name));
        Chrome.update([[windowId, name]]);
    }
}

//@ (Number, Number, String, String, Boolean) -> state
async function populateWindow(windowId, initTabId, folderId, name, remove) {
    nowProcessing.add(folderId).add(windowId);
    const { bookmarks, subfolders } = await readFolder(folderId);

    if (bookmarks.length) {
        const openingTabs = bookmarks.map(bookmark => openTab(bookmark, windowId, name));
        Promise.any(openingTabs).then(() => browser.tabs.remove(initTabId));
        await Promise.all(openingTabs);
    }
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

const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);

//@ (Number), state -> (Boolean)
export const canUnstash = async nodeId =>
    !( ROOT_IDS.has(nodeId) || nowProcessing.has(nodeId) || isSeparator(await getNode(nodeId)) );

//@ (Object) -> (Boolean)
const isSeparator = node => node.type === 'separator';
const isFolder    = node => node.type === 'folder';    //@ (Object) -> (Boolean)
const isBookmark  = node => node.type === 'bookmark';  //@ (Object) -> (Boolean)

const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0]; //@ (Number), state -> (Object)
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId); //@ (Number), state -> (Promise: [Object])

const createNode = properties => browser.bookmarks.create(properties); //@ (Object) -> (Promise: Object), state
const removeNode = nodeId => browser.bookmarks.remove(nodeId); //@ (Number) -> (Promise: Object), state
const createFolder = (title, parentId) => createNode({ title, parentId }); //@ (String, Number) -> (Promise: Object), state
