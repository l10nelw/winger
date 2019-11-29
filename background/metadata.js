import * as BrowserOp from './browser.js';

export let windows = {};
export let focusedWindow = { id: null };
const invalidCharsNameRegex = /^\/|['"]/;
let lastWindowNumber = 0;

export async function add(windowObject) {
    const windowId = windowObject.id;
    const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;
    const defaultName = createDefaultName(windowId);
    const now = Date.now();

    // Fetch stored data
    const [
        givenName = '',
        textColor = '#fff',
        backColor = '#00f',
    ] = await Promise.all(
        ['givenName', 'textColor', 'backColor'].map(key => browser.sessions.getWindowValue(windowId, key))
    );

    windows[windowId] = {
        id: windowId,
        displayName: givenName || defaultName,
        defaultName,
        givenName,
        textColor,
        backColor,
        tabCount,
        created: now,
        lastFocused: now,
    };
}

function createDefaultName(windowId) {
    let name;
    do {
        name = `Window ${++lastWindowNumber}`;
    } while (nameExists(windowId, name));
    return name;
}

export function remove(windowId) {
    delete windows[windowId];
}

// Validate and store givenName for target window.
// Automatically sets displayName.
// Returns 0 if successful, otherwise returns output of isInvalidName().
export function setName(windowId, name = '') {
    const metaWindow = windows[windowId];
    const error = isInvalidName(windowId, name);
    if (error) return error;
    metaWindow.givenName = name;
    metaWindow.displayName = metaWindow.givenName || metaWindow.defaultName;
    browser.sessions.setWindowValue(windowId, 'givenName', name);
    BrowserOp.title.update(windowId);
    BrowserOp.menu.update(windowId);
    return 0;
}

// Validate name for target window.
// Valid if blank, or unique and has no disallowed characters.
// Returns 0 if valid, otherwise returns -1 or id of conflicting window.
function isInvalidName(windowId, name) {
    if (!name) return 0;
    if (invalidCharsNameRegex.test(name)) return -1;
    return nameExists(windowId, name);
}

// Check if name conflicts with other windows.
// Name that is identical to target window's givenName or defaultName: not considered a conflict.
// Returns id of conflicting window, otherwise returns 0.
function nameExists(windowId, name) {
    for (const id in windows) {
        if (id == windowId) continue;
        const metaWindow = windows[id];
        if (metaWindow.givenName == name || metaWindow.defaultName == name) {
            return metaWindow.id;
        }
    }
    return 0;
}

// Sort windows by sortMethod, return windowIds.
export function sortedIds(sortBy = 'lastFocused') {
    let metaWindows = Object.values(windows);
    metaWindows.sort(sortMethod[sortBy]);
    const windowIds = metaWindows.map(object => object.id);
    return windowIds;
}

const sortMethod = {
    age: (a, b) => a.created - b.created,
    lastFocused: (a, b) => b.lastFocused - a.lastFocused,
    alphabetical: (a, b) => {
        if (a.displayName > b.displayName) return 1;
        if (a.displayName < b.displayName) return -1;
        return 0;
    }
}