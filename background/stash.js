import * as Name from './name.js';
import * as Placeholder from './placeholder.js';
import * as Metadata from './metadata.js';
import { SETTINGS } from './settings.js';

let HOME_ID;

// Identify the stash home's folder id based on settings.
export async function init() {
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
        addSeparator(HOME_ID);
    }
}

function findSeparator(nodes) {
    for (let i = nodes.length; i--;) { // Reverse iterate
        if (isSeparator(nodes[i])) return i;
    }
    return -1;
}
const findFolderByTitle = (nodes, title) => nodes.find(node => node.title === title && node.type === 'folder');
const addSeparator = parentId => browser.bookmarks.create({ type: 'separator', parentId });


/* --- LIST FOLDERS --- */

export const folderMap = new Map();

folderMap.populate = async () => {
    const nodes = (await browser.bookmarks.getSubTree(HOME_ID))[0].children; // Contents of stash home
    for (let i = nodes.length; i--;) { // Reverse iterate
        const node = nodes[i];
        switch (node.type) {
            case 'separator': return; // Stop at first separator from the end
            case 'folder':
                const id = node.id;
                const bookmarkCount = node.children.filter(isBookmark).length;
                folderMap.set(id, { id, title: node.title, bookmarkCount });
        }
    }
}


/* --- STASH WINDOW --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder, and close window.
export async function stash(windowId) {
    Metadata.windowMap[windowId].stashing = true;
    const name = Metadata.getName(windowId);
    const [tabs, folder] = await Promise.all([ browser.tabs.query({ windowId }), getTargetFolder(name) ]);
    const parentId = folder.id;
    for (let i = tabs.length; i--;) { // Reverse iteration necessary for bookmarks to be in correct order
        let { title, url } = tabs[i];
        if (Placeholder.isTabURL(url)) url = Placeholder.getTargetURL(url);
        browser.bookmarks.create({ title, url, parentId });
    }
    closeWindow(windowId);
    return folder;
}

//For a given name, return matching bookmarkless folder or create folder and return it.
async function getTargetFolder(name) {
    const isMapEmpty = !folderMap.size;
    if (isMapEmpty) await folderMap.populate();
    for (const [, folder] of folderMap) {
        if (folder.title === name && !folder.bookmarkCount) return folder; // Existing folder with same name and no bookmarks found
    }
    if (isMapEmpty) folderMap.clear();
    return createFolder(name);
}

async function closeWindow(windowId) {
    await browser.windows.remove(windowId);
    const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
    if (!sessions.length) return;
    const session = sessions[0];
    if (session.tab) return;
    browser.sessions.forgetClosedWindow(session.window.sessionId);
}


/* --- UNSTASH WINDOW --- */

// Turn folder/bookmarks into window/tabs.
// If folder, create and populate window. Bookmarks and empty folder are removed.
export async function unstash(nodeId) {
    const node = (await browser.bookmarks.get(nodeId))[0];
    switch (node.type) {
        case 'bookmark':
            const currentWindow = await browser.windows.getLastFocused();
            turnBookmarkIntoTab(node, currentWindow.id, true);
            break;
        case 'folder':
            unstash.info = unstash.createWindow(node);
    }
}

// Create window and let onWindowCreated() in background.js trigger the rest of the unstash process.
unstash.createWindow = async folder => {
    const window = await browser.windows.create();
    return {
        windowId:   window.id,
        blankTabId: window.tabs[0].id,
        folderId:   folder.id,
        name:       folder.title,
    };
}

unstash.onWindowCreated = async windowId => {
    const info = await unstash.info;
    if (windowId !== info?.windowId) return;
    delete unstash.info;

    const name = Name.uniquify(Name.validify(info.name), windowId);
    Metadata.giveName(windowId, name);

    const bookmarks = (await getChildNodes(info.folderId)).filter(isBookmark);
    if (bookmarks.length) {
        await Promise.all( bookmarks.map(b => turnBookmarkIntoTab(b, windowId)) ); // Populate window
        browser.tabs.remove(info.blankTabId); // Remove initial blank tab
    }
    browser.bookmarks.remove(info.folderId).catch(() => null); // Remove folder if empty
}

async function turnBookmarkIntoTab({ url, title, id }, windowId, active) {
    const properties = (url === 'about:newtab')
        ? { windowId, active }
        : { windowId, active, discarded: !active, title: (active ? null : title), url }; // Only discarded tab can be given title
    const creating = browser.tabs.create(properties).catch(() => Placeholder.openTab(properties, title));
    const removing = browser.bookmarks.remove(id);
    const [tab,] = await Promise.all([ creating, removing ]);
    return tab;
}


/* --- */

const ROOT_IDS = ['toolbar_____', 'menu________', 'unfiled_____'];
export const isRootId = nodeId => ROOT_IDS.includes(nodeId);
export const isSeparator = node => node.type === 'separator';

const isBookmark = node => node.type === 'bookmark';
const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);
const createFolder = (title, parentId = HOME_ID) => browser.bookmarks.create({ title, parentId });

