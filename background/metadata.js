import * as BrowserOp from './browser.js';

export let windows = {};
export let focusedWindow = { id: null };
const invalidCharsNameRegex = /^\/|['"]/;
let lastWindowNumber = 0;

export async function add(windowObject) {
    const windowId = windowObject.id;
    const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;
    const now = Date.now();

    // Generate unique defaultName
    let number, defaultName;
    do {
        number = ++lastWindowNumber;
        defaultName = `Window ${number} / id ${windowId}`;
    } while (isInvalidName(windowId, defaultName));

    windows[windowId] = {
        id: windowId,
        number,
        displayName: defaultName,
        defaultName,
        givenName: '',
        tabCount,
        textColor: '#fff',
        backColor: '#00f',
        created: now,
        lastFocused: now,
    };
}

export function remove(windowId) {
    delete windows[windowId];
}

export function has(windowId) {
    return windowId in windows;
}

export async function init() {
    const allWindows = await browser.windows.getAll({ populate: true });
    for (const windowObject of allWindows) {
        add(windowObject);
        const windowId = windowObject.id;
        if (windowObject.focused) focusedWindow.id = windowId;
        BrowserOp.updateWindowBadge(windowId);
        BrowserOp.menu.create(windowId);
    }
}

export function getName(windowId) {
    return windows[windowId].displayName;
}

// Validate and then assign givenName for target window.
// Automatically sets displayName.
// Returns 0 if successful, otherwise returns output of isInvalidName().
export function setName(windowId, name = '') {
    const metaWindow = windows[windowId];
    const error = isInvalidName(windowId, name);
    if (!error) {
        metaWindow.givenName = name;
        metaWindow.displayName = metaWindow.givenName || metaWindow.defaultName;
        BrowserOp.menu.rename(windowId);
    }
    return error;
}

// Validate name for target window.
// Valid if blank, or unique and has no disallowed characters.
// Returns 0 if valid, otherwise returns -1 or id of conflicting window.
function isInvalidName(windowId, name) {
    if (!name) return 0;
    if (invalidCharsNameRegex.test(name)) return -1;
    return nameExists(windowId, name);
}

// Check if name exists in other windows.
// Note if name is same as target window's givenName or defaultName, there is no conflict.
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