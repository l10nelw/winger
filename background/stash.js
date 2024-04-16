import * as Name from '../name.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Winfo from './winfo.js';
import * as Storage from '../storage.js';
import * as StashProp from './stash.prop.js';

export const nowProcessing = new Set(); // Ids of windows and folders currently involved in any stashing/unstashing operations


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
        Storage.set({ _stash_home_id: folder.id });
    } else {
        // Home is a root folder
        Storage.set({ _stash_home_id: stash_home_root });
        if (!nodes.findLast(isSeparator))
            // Home has no separator
            createNode({ type: 'separator', parentId: stash_home_root });
    }
}

//@ ([Object], String) -> (Object)
const findFolderByTitle = (nodes, title) => nodes.find(node => isFolder(node) && node.title === title);


/* --- LIST FOLDERS --- */

export const folderMap = new Map();

//@ state -> state
folderMap.populate = async () => {
    const nodes = (await browser.bookmarks.getSubTree(await Storage.getValue('_stash_home_id')))[0].children;
    for (let i = nodes.length; i--;) { // Reverse iterate
        const node = nodes[i];
        switch (node.type) {
            case 'separator':
                return; // Stop at first separator from the end
            case 'folder':
                const id = node.id;
                node.bookmarkCount = nowProcessing.has(id) ?
                    0 : node.children.filter(isBookmark).length;
                folderMap.set(id, node);
        }
    }
}
//@ (String), state -> (Object)
folderMap.findBookmarkless = title => {
    for (const folder of folderMap.values())
        if (!folder.bookmarkCount && folder.title === title)
            return folder;
}


/* --- STASH WINDOW/TABS --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder. Close window if remove is true.
//@ (Number, String, Boolean), state -> state
export async function stashWindow(windowId, name, remove) {
    nowProcessing.add(windowId);
    const [window, allWindows] = await Promise.all([
        browser.windows.get(windowId, { populate: true }),
        remove && browser.windows.getAll(),
    ]);
    name = StashProp.Window.stringify(name, window);
    await handleLoneWindow(
        windowId, remove, allWindows,
        createBookmarksAtNode(window.tabs, await getTargetFolder(name), name),
        () => browser.windows.remove(windowId),
    );
    nowProcessing.delete(windowId);
}

// Turn current window's selected tabs into bookmarks at targeted bookmark location or in targeted folder.
// Close tabs if remove is true.
//@ (String, Boolean), state -> state
export async function stashSelectedTabs(nodeId, remove) {
    const [tabs, node] = await Promise.all([
        browser.tabs.query({ currentWindow: true }),
        getNode(nodeId),
    ]);
    const windowId = tabs[0].windowId;
    nowProcessing.add(windowId);
    const selectedTabs = tabs.filter(tab => tab.highlighted);
    delete selectedTabs.find(tab => tab.active)?.active; // Avoid adding extra active tab to target stashed window
    const allWindows = remove && (selectedTabs.length === tabs.length) ?
        await browser.windows.getAll() : null;
    await handleLoneWindow(
        windowId, remove, allWindows,
        createBookmarksAtNode(selectedTabs, node),
        () => browser.tabs.remove(selectedTabs.map(tab => tab.id)),
    );
    nowProcessing.delete(windowId);
}

// For a given name (folder title), return a matching bookmarkless folder, otherwise return a new folder.
//@ (String), state -> (Object), state
async function getTargetFolder(name) {
    await folderMap.populate();
    const folder = folderMap.findBookmarkless(name) || await createFolder(name, await Storage.getValue('_stash_home_id'));
    folderMap.clear();
    return folder;
}

// In case of a lone window to be closed, keep it open until stash operation is complete.
//@ (Number, Boolean, [Object]|null, Promise:[Object], Function) -> state
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

//@ ([Object], Object, String|undefined), state -> ([Object]), state
async function createBookmarksAtNode(tabs, node, logName = '') {
    const isNodeFolder = isFolder(node);
    const [folder,] = await Promise.all([
        isNodeFolder ? node : getNode(node.parentId),
        StashProp.Tab.prepare(tabs),
    ]);
    const folderId = folder.id;
    nowProcessing.add(folderId);

    const index = isNodeFolder ? null : node.index;
    const count = tabs.length;
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, index, logName);
    const bookmarks = await Promise.all(creatingBookmarks);

    nowProcessing.delete(folderId);
    return bookmarks;
}

//@ (Object, String, Number|null, String) -> (Promise: Object), state
function createBookmark(tab, parentId, index, logName) {
    const url = Auto.deplaceholderize(tab.url);
    const title = StashProp.Tab.stringify(tab, parentId);
    console.log(`Stashing ${logName} | ${url} | ${title}`);
    return createNode({ parentId, url, title, index });
}


/* --- UNSTASH WINDOW/TAB --- */

// Turn folder/bookmarks into window/tabs. Delete folder/bookmarks if remove is true.
//@ (String, Boolean), state -> state
export async function unstashNode(nodeId, remove = true) {
    const node = (await browser.bookmarks.get(nodeId))[0];
    switch (node.type) {
        case 'bookmark':
            return unstashBookmark(node, remove);
        case 'folder':
            return unstashFolder(node, remove);
    }
}

// Unstash single bookmark to current window.
// This operation will not appear in nowProcessing.
//@ (Object, Boolean), state -> state
async function unstashBookmark(node, remove) {
    const window = await browser.windows.getLastFocused();
    const protoTab = { url: node.url, windowId: window.id, ...StashProp.Tab.parse(node.title) };
    await StashProp.Tab.preOpen([protoTab], window);
    const tab = await openTab(protoTab);
    browser.tabs.update(tab.id, { active: true });
    if (remove)
        removeNode(node.id);
}

//@ (Object, Boolean) -> (Object), state
async function unstashFolder(folder, remove) {
    const [name, protoWindow] = StashProp.Window.parse(folder.title);
    const [window, auto_name_unstash] = await Promise.all([
        browser.windows.create(protoWindow),
        Storage.getValue('auto_name_unstash'),
    ]);
    const folderId = folder.id;
    const windowId = window.id;
    nowProcessing.add(folderId).add(windowId); // To be removed in populateWindow()
    if (auto_name_unstash)
        nameWindow(windowId, name);
    populateWindow(window, folderId, name, remove);
}

//@ (Number, String) -> state
async function nameWindow(windowId, name) {
    name = Name.validify(name);
    if (!name)
        return;
    const nameMap = (new Name.NameMap()).populate(await Winfo.getAll(['givenName']));
    name = nameMap.uniquify(name);
    Name.save(windowId, name);
    Chrome.update([[windowId, name]]);
}

//@ (Object, String, String, Boolean) -> state
async function populateWindow(window, folderId, logName, remove) {
    const windowId = window.id;
    const { bookmarks, subfolders } = await readFolder(folderId);

    if (bookmarks.length) {
        let protoTabs, openingTabs;

        protoTabs = bookmarks.map(({ title, url }) => ({ windowId, url, ...StashProp.Tab.parse(title) }));
        await StashProp.Tab.preOpen(protoTabs, window);
        openingTabs = protoTabs.map(protoTab => openTab(protoTab, logName));

        Promise.any(openingTabs).then(() => browser.tabs.remove(window.tabs[0].id)); // Remove initial tab
        const tabs = await Promise.all(openingTabs);
        StashProp.Tab.postOpen(protoTabs, tabs);
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

//@ (Object, String|undefined) -> (Promise: Object), state
function openTab(protoTab, logName = '') {
    console.log(`Unstashing ${logName} | ${protoTab.url} | ${protoTab.title}`);
    const safeProtoTab = StashProp.Tab.scrub(protoTab);
    safeProtoTab.discarded = true;
    return Action.openTab(safeProtoTab);
}


/* --- MENU HELPERS --- */

// Can tabs in given or current window be stashed at/into this node?
//@ (String, Number|undefined), state -> (Boolean)
export async function canStashHere(nodeId, windowId = null) {
    return !(
        nowProcessing.has(nodeId) || // Folder is being processed
        nowProcessing.has(windowId || await Storage.getValue('_focused_window_id')) || // Window is being processed
        nowProcessing.has((await getNode(nodeId)).parentId) // Parent folder is being processed
    );
}

// Can given node be unstashed?
//@ (String), state -> (Boolean)
export async function canUnstashThis(nodeId) {
    if (ROOT_IDS.has(nodeId) || nowProcessing.has(nodeId)) // Is root folder, or folder is being processed
        return false;
    const node = await getNode(nodeId);
    if (isSeparator(node) || nowProcessing.has(node.parentId)) // Is separator, or parent folder is being processed
        return false;
    return true;
}


/* --- */

const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);

//@ (Object) -> (Boolean)
const isSeparator = node => node.type === 'separator';
const isFolder    = node => node.type === 'folder';
const isBookmark  = node => node.type === 'bookmark';

const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0]; //@ (Number), state -> (Object)
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId); //@ (Number), state -> (Promise: [Object])

const createNode = properties => browser.bookmarks.create(properties); //@ (Object) -> (Promise: Object), state
const removeNode = nodeId => browser.bookmarks.remove(nodeId); //@ (Number) -> (Promise: Object), state
const createFolder = (title, parentId) => createNode({ title, parentId }); //@ (String, Number) -> (Promise: Object), state
