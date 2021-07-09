import * as Name from './name.js';
import * as Action from './action.js';

let HOME_ID;
const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);
const nowStashing   = new Set();
const nowUnstashing = new Set();


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
                const bookmarkCount = nowUnstashing.has(id) ? 0 : node.children.filter(isBookmark).length;
                folderMap.set(id, { id, title, bookmarkCount });
        }
    }
}

const getHomeContents = async () => (await browser.bookmarks.getSubTree(HOME_ID))[0].children;


/* --- STASH WINDOW --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder, and close window.
export async function stash(windowId) {
    const name = Name.get(windowId);
    const tabs = await browser.tabs.query({ windowId });
    closeWindow(windowId); // Close window before starting any bookmark-related operations

    const folderId = (await getTargetFolder(name)).id;
    nowStashing.add(folderId);
    await saveTabs(tabs, folderId);
    nowStashing.delete(folderId);
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

//For a given name, return matching bookmarkless folder, otherwise return new folder.
async function getTargetFolder(name) {
    const isMapEmpty = !folderMap.size;
    if (isMapEmpty) await folderMap.populate();
    for (const [, folder] of folderMap) {
        if (folder.title === name && !folder.bookmarkCount) return folder; // Existing folder with same name and has no bookmarks
    }
    if (isMapEmpty) folderMap.clear();
    return createFolder(name);
}

async function saveTabs(tabs, folderId) {
    const count = tabs.length;
    const creatingBookmarks = new Array(count);
    for (let i = count; i--;) // Reverse iteration necessary for bookmarks to be in correct order
        creatingBookmarks[i] = createBookmark(tabs[i], folderId);
    await Promise.all(creatingBookmarks);
}

async function createBookmark(tab, parentId) {
    const url = Action.deplaceholderize(tab.url);
    console.log('Stashing', url);
    return createNode({ parentId, url, title: tab.title });
}


/* --- UNSTASH WINDOW --- */

// Turn folder/bookmarks into window/tabs.
export async function unstash(nodeId) {
    const node = (await browser.bookmarks.get(nodeId))[0];
    switch (node.type) {
        case 'bookmark':
            // Open in current window; remove bookmark
            const currentWindow = await browser.windows.getLastFocused();
            openTab(node, currentWindow.id, true);
            removeNode(node.id);
            break;
        case 'folder':
            // Create and populate window; remove bookmarks and also folder if emptied
            unstash.info = unstash.createWindow(node);
    }
}

// Create window and let onWindowCreated() in background.js trigger the rest of the unstash process.
unstash.createWindow = async folder => {
    const window = await browser.windows.create();
    return {
        windowId:  window.id,
        initTabId: window.tabs[0].id,
        folderId:  folder.id,
        name:      folder.title,
    };
}

unstash.onWindowCreated = async windowId => {
    const info = await unstash.info;
    if (windowId !== info?.windowId) return;
    delete unstash.info;

    const name = Name.uniquify(Name.validify(info.name), windowId);
    Name.set(windowId, name);

    const { folderId } = info;
    nowUnstashing.add(folderId);
    const { bookmark: bookmarks, folder: subfolders } = await readFolder(folderId);

    await Promise.all( bookmarks.map(bookmark => openTab(bookmark, windowId)) );
    browser.tabs.remove(info.initTabId);

    subfolders.length // If folder contains subfolders
        ? await Promise.all( bookmarks.map(bookmark => removeNode(bookmark.id)) ) // remove each bookmark individually
        : await browser.bookmarks.removeTree(folderId); // else remove entire folder
    nowUnstashing.delete(folderId);
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

// Open tab from bookmark
function openTab({ url, title }, windowId) {
    console.log('Unstashing', url);
    return Action.openTab({ url, title, windowId, discarded: true });
}


/* --- */

export const canUnstash = async nodeId =>
    !( isRootId(nodeId) || nowStashing.has(nodeId) || nowUnstashing.has(nodeId) || isSeparator(await getNode(nodeId)) );

const isRootId    = nodeId => ROOT_IDS.has(nodeId);
const isSeparator = node => node.type === 'separator';
const isFolder    = node => node.type === 'folder';
const isBookmark  = node => node.type === 'bookmark';

const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0];
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);

const createNode = properties => browser.bookmarks.create(properties);
const createFolder = (title, parentId = HOME_ID) => createNode({ title, parentId });
const removeNode = nodeId => browser.bookmarks.remove(nodeId);
