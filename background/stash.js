import * as Name from './name.js';
import * as Metadata from './metadata.js';
import { SETTINGS } from './settings.js';

const ROOT_ID = 'toolbar_____'; // menu________, unfiled_____
const START_AFTER_SEPARATOR = true;

const isBookmark = node => node.type === 'bookmark';

/* --- LIST (& FIX) FOLDERS --- */

// List of stashed-window folders, to be populated/cleared when popup opens/closes.
// This keeps checkFolders() data available in this module throughout the popup's duration.
export const list = [];

list.populate = async () => {
    list.push(...await checkFolders());
    return list;
}

list.clear = () => list.length = 0;

// Return an array of simplified folder objects { id, title, bookmarkCount } with unique names, representing stashed-windows.
// Side-effect: Rename any folders with invalid names.
async function checkFolders() {
    const nodes = (await browser.bookmarks.getSubTree(ROOT_ID))[0].children;
    const folders = [];
    const names = new Set();
    for (const node of nodes) {
        switch (node.type) {
            case 'folder':
                const id = node.id;
                const title = fixFolderName(id, node.title);
                if (names.has(title)) continue; // Ignore folder if name already exists
                const folder = {
                    id,
                    title,
                    bookmarkCount: node.children.filter(isBookmark).length,
                };
                folders.push(folder);
                names.add(title);
                break;
            case 'separator':
                if (START_AFTER_SEPARATOR) {
                    folders.length = 0;
                    names.clear();
                }
        }
    }
    return folders;
}

// Rename folder if its name is invalid. Return name.
function fixFolderName(id, name) {
    const fixedName = Name.fix(name);
    if (fixedName !== name) browser.bookmarks.update(id, { title: fixedName });
    return fixedName;
}


/* --- STASH WINDOW --- */

// Turn window/tabs into folder/bookmarks.
// Create folder if nonexistent, save tabs as bookmarks in folder, and close window.
export async function stash(windowId) {
    const name = Metadata.getName(windowId);
    const [tabs, folder] = await Promise.all([ browser.tabs.query({ windowId }), getStashFolder(name) ]);
    const parentId = folder.id;
    for (const { title, url } of tabs) {
        await browser.bookmarks.create({ title, url, parentId }); // Serial await necessary for bookmarks to be in order
    }
    browser.windows.remove(windowId);
    return folder;
}

//For a given name (title), return matching folder or create folder and return its promise.
async function getStashFolder(title) {
    const folders = list.length ? list : await checkFolders();
    let sameNameFolder, createFolderPromise;

    // Name conflict check
    while (true) {
        sameNameFolder = folders.find(folder => folder.title === title);
        if (!sameNameFolder) {
            // No conflict; create new folder and proceed
            createFolderPromise = browser.bookmarks.create({ title, parentId: ROOT_ID });
            break;
        }
        if (!sameNameFolder.bookmarkCount) break; // Existing folder has no bookmarks; proceed
        title = Name.applyNumberPostfix(title); // Uniquify name and repeat check
    }
    return createFolderPromise || sameNameFolder;
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
            unstash.createWindow(node);
    }
}

// Create window and let onWindowCreated() in background.js trigger the rest of the unstash process.
unstash.createWindow = async folder => {
    const window = await browser.windows.create();
    unstash._windowId   = window.id;
    unstash._blankTabId = window.tabs[0].id;
    unstash._folderId   = folder.id;
    unstash._title      = folder.title;
}

unstash.onWindowCreated = async windowId => {
    if (windowId !== unstash._windowId) return;

    // Name window
    let name = unstash._title;
    while (true) {
        const error = Metadata.giveName(windowId, name);
        if (!error) break;
        name = Name.applyNumberPostfix(name);
    }

    const folderId = unstash._folderId;
    const bookmarks = (await browser.bookmarks.getChildren(folderId)).filter(isBookmark);
    if (bookmarks.length) {
        await Promise.all( bookmarks.map(b => turnBookmarkIntoTab(b, windowId)) ); // Populate window
        browser.tabs.remove(unstash._blankTabId); // Remove initial blank tab
    }
    browser.bookmarks.remove(folderId).catch(() => null); // Remove folder if empty

    unstash._windowId   = null;
    unstash._blankTabId = null;
    unstash._folderId   = null;
    unstash._title      = null;
}

async function turnBookmarkIntoTab({ url, title, id }, windowId, active) {
    const properties = (url === 'about:newtab')
        ? { windowId, active }
        : { windowId, active, discarded: !active, title: (active ? null : title), url }; // Only discarded tab can be given title
    const creating = browser.tabs.create(properties).catch(() => openUrlPage(properties));
    const removing = browser.bookmarks.remove(id);
    const [tab,] = await Promise.all([ creating, removing ]);
    return tab;
}

//TODO
function openUrlPage(properties) {
    browser.tabs.create({ windowId: properties.windowId });
    console.log('openUrlPage', properties);
}

