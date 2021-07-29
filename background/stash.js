import * as Name from './name.js';
import * as Action from './action.js';
import * as State from './stash.state.js';

let HOME_ID;
const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);
const nowProcessing = new Map(); // Ids of windows and folders currently being stashed or unstashed


/* --- INIT --- */

// Identify the stash home's folder id based on settings.
export async function init(SETTINGS) {
    let rootId = SETTINGS.stash_home; // Id of a root folder; may be followed by a marker character indicating that home is a subfolder
    let nodes;
    const isRoot = isRootId(rootId);
    if (isRoot) {
        HOME_ID = rootId;
        nodes = await getChildNodes(rootId);
    } else {
        // Home is subfolder of root folder
        rootId = rootId.slice(0, -1); // Remove marker
        nodes = await getChildNodes(rootId);
        const title = SETTINGS.stash_home_name;
        const folder = findFolderByTitle(nodes, title);
        HOME_ID = folder ? folder.id : (await createFolder(title, rootId)).id;
    }
    if (isRoot && nodes.length && findSeparator(nodes) === -1) { // If home is a root folder, not empty and has no separator
        createNode({ type: 'separator', parentId: HOME_ID });
    }
}

function findSeparator(nodes) {
    for (let i = nodes.length; i--;) { // Reverse iterate
        if (isSeparator(nodes[i])) return i;
    }
    return -1;
}

const findFolderByTitle = (nodes, title) => nodes.find(node => node.title === title && isFolder(node));


/* --- LIST FOLDERS --- */

export const folderMap = new Map();

folderMap.populate = async () => {
    const nodes = await getHomeContents();
    for (let i = nodes.length; i--;) { // Reverse iterate
        const node = nodes[i];
        switch (node.type) {
            case 'separator': return; // Stop at first separator from the end
            case 'folder':
                const { id, title } = node;
                const bookmarkCount = nowProcessing.has(id) ? 0 : node.children.filter(isBookmark).length;
                folderMap.set(id, { id, title, bookmarkCount });
        }
    }
}

const getHomeContents = async () => (await browser.bookmarks.getSubTree(HOME_ID))[0].children;


/* --- STASH WINDOW --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder. Close window if remove is true.
export async function stash(windowId, remove = true) {
    const name = Name.get(windowId);
    console.log('Stashing', name);
    const tabs = await browser.tabs.query({ windowId });
    if (remove) closeWindow(windowId);

    const folderId = (await getTargetFolder(name)).id;
    nowProcessing.set(folderId);
    await saveTabs(tabs, folderId);
    nowProcessing.delete(folderId);
}

async function closeWindow(windowId) {
    await browser.windows.remove(windowId);
    forgetRecentlyClosedWindow(); // Remove unnecessary entry in Recently Closed Windows
}

async function forgetRecentlyClosedWindow() {
    const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
    const windowSession = sessions?.[0]?.window;
    if (windowSession) browser.sessions.forgetClosedWindow(windowSession.sessionId);
}

// For a given name, return matching bookmarkless folder, otherwise return new folder.
async function getTargetFolder(name) {
    const isMapEmpty = !folderMap.size;
    if (isMapEmpty) await folderMap.populate();
    const folder = findBookmarklessFolder(name);
    if (isMapEmpty) folderMap.clear();
    return folder || createFolder(name);
}

function findBookmarklessFolder(name) {
    for (const folder of folderMap.values()) {
        if (folder.title === name && !folder.bookmarkCount) return folder;
    }
}

async function saveTabs(tabs, folderId) {
    const containerDict = await State.getContainerDict(tabs);
    const count = tabs.length;
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId, containerDict);
    await Promise.all(creatingBookmarks);
}

function createBookmark(tab, parentId, containerDict) {
    const url = Action.deplaceholderize(tab.url);
    console.log('Stashing', url, '|', tab.title);
    const title = State.writeTabTitle(tab, parentId, containerDict);
    return createNode({ parentId, url, title });
}


/* --- UNSTASH WINDOW --- */

// Turn folder/bookmarks into window/tabs. Delete folder/bookmarks if remove is true.
export async function unstash(nodeId, remove = true) {
    const node = (await browser.bookmarks.get(nodeId))[0];

    if (isBookmark(node)) return unstashTab(node, remove);

    if (isFolder(node)) {
        const window = await browser.windows.create();
        nowProcessing.set(window.id, {
            folderId:  node.id,
            name:      node.title,
            initTabId: window.tabs[0].id,
            remove,
        });
        // Let onWindowCreated() in background.js trigger the rest of the unstash process
    }
}

async function unstashTab(node, remove) {
    const currentWindow = await browser.windows.getLastFocused();
    const { url, title } = node;
    openTab({ url, title, ...State.readTitle(title), windowId: currentWindow.id });
    if (remove) removeNode(node.id);
}

unstash.onWindowCreated = async windowId => {
    if (!nowProcessing.has(windowId)) return;
    const { folderId, name, initTabId, remove } = nowProcessing.get(windowId);
    console.log('Unstashing', name);
    Name.set(windowId, Name.uniquify(Name.validify(name), windowId));

    nowProcessing.set(folderId);
    const { bookmark: bookmarks, folder: subfolders } = await readFolder(folderId);
    const protoTabs = bookmarks.map(({ url, title }) => ({ url, title, ...State.readTitle(title), windowId, discarded: true }));
    const tabMap = new State.UntashedTabMap();
    await Promise.all( protoTabs.map(protoTab => openTab(protoTab, tabMap)) );
    browser.tabs.remove(initTabId);
    tabMap.restoreParents();
    nowProcessing.delete(windowId);

    if (remove) {
        subfolders.length // If folder contains subfolders
        ? await Promise.all( bookmarks.map(bookmark => removeNode(bookmark.id)) ) // remove each bookmark individually
        : await browser.bookmarks.removeTree(folderId); // else remove entire folder
    }
    nowProcessing.delete(folderId);
}

async function readFolder(folderId) {
    const nodesByType = {
        bookmark: [],
        folder: [],
    };
    for (const node of await getChildNodes(folderId)) {
        nodesByType[node.type]?.push(node);
    }
    return nodesByType;
}

async function openTab(protoTab, tabMap) {
    console.log('Unstashing', protoTab.url, '|', protoTab.title);
    const tab = await Action.openTab(protoTab);
    tabMap?.addTab(tab, protoTab);
    return tab;
}


/* --- */

export const canUnstash = async nodeId =>
    !( isRootId(nodeId) || nowProcessing.has(nodeId) || isSeparator(await getNode(nodeId)) );

const isRootId    = nodeId => ROOT_IDS.has(nodeId);
const isSeparator = node => node.type === 'separator';
const isFolder    = node => node.type === 'folder';
const isBookmark  = node => node.type === 'bookmark';

const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0];
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);

const createNode = properties => browser.bookmarks.create(properties);
const createFolder = (title, parentId = HOME_ID) => createNode({ title, parentId });
const removeNode = nodeId => browser.bookmarks.remove(nodeId);
