import * as Metadata from './metadata.js';
import { SETTINGS } from './settings.js';

const ROOT_FOLDER = 'toolbar_____'; // menu________, unfiled_____
const START_AFTER_SEPARATOR = true;

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

export async function getFolders(parentId = ROOT_FOLDER) {
    const nodes = await browser.bookmarks.getChildren(parentId);
    let folders = [];
    for (const node of nodes) {
        const type = node.type;
        if (type === 'folder') folders.push(node);
        if (START_AFTER_SEPARATOR && type === 'separator') folders = [];
    }
    return folders;
}