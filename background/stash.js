import * as Name from './name.js';
import * as Metadata from './metadata.js';
import { SETTINGS } from './settings.js';

const ROOT_ID = 'toolbar_____'; // menu________, unfiled_____
const START_AFTER_SEPARATOR = true;


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


export async function stash(windowId) {
    const title = Metadata.getName(windowId);
    const [tabs, folder] = await Promise.all([ getTabs(windowId), createFolder(title) ]);
    const parentId = folder.id;
    for (const { title, url } of tabs) await browser.bookmarks.create({ title, url, parentId });
    browser.windows.remove(windowId);
    return folder;
}

const getTabs = async windowId => (await browser.windows.get(windowId, { populate: true })).tabs;
const createFolder = async title => (await browser.bookmarks.create({ title, parentId: ROOT_FOLDER }));

export async function unstash(folder) {
    const folderId = folder.id;
    const bookmarks = (await browser.bookmarks.getChildren(folderId)).filter(node => node.type === 'bookmark');

    // Create window with first bookmark, create tabs with the rest
    const windowId = await createWindow(bookmarks.shift());
    for (const bookmark of bookmarks) await turnBookmarkIntoTab(windowId, bookmark);

    nameWindow(windowId, folder.title.trim());
    browser.bookmarks.remove(folderId).catch(() => console.error(`can't remove folder`));
}

async function createWindow(bookmark) {
    const { id: windowId, tabs: blankTabs } = await browser.windows.create();
    await turnBookmarkIntoTab(windowId, bookmark);
    browser.tabs.remove(blankTabs[0].id);
    return windowId;
}

async function turnBookmarkIntoTab(windowId, { url, title, id: bookmarkId }) {
    const properties = { windowId, url, title, discarded: true };
    const creating = browser.tabs.create(properties).catch(() => openUrlPage(properties));
    const removing = browser.bookmarks.remove(bookmarkId);
    await Promise.all([ creating, removing ]);
}

function nameWindow(windowId, name) {
    let error;
    while (true) {
        error = Metadata.giveName(windowId, name);
        if (!error) return;
        name += '!';
    }
}

function openUrlPage(properties) {
    browser.tabs.create({ windowId: properties.windowId });
    console.log('openUrlPage', properties);
}

const isBookmark = node => node.type === 'bookmark';
