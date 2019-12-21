export let windows = {};
export let focusedWindow = { id: null };
const invalidCharsNameRegex = /^\/|['"]/;
let lastWindowNumber = 0;

export async function init(windowObjects) {
    let windowIds = [];
    for (const windowObject of windowObjects) {
        const windowId = windowObject.id;
        windowIds.push(windowId);
        windows[windowId] = createMetaWindow(windowObject);
    }
    await retrieveGivenNames(windowIds);
    setDefaultAndDisplayNames(windowIds);
}

export async function add(windowObject) {
    const windowId = windowObject.id;
    windows[windowId] = createMetaWindow(windowObject);
    await retrieveGivenNames([windowId]);
    setDefaultAndDisplayNames([windowId]);
}

function createMetaWindow(windowObject) {
    const now = Date.now();
    return {
        id: windowObject.id,
        created: now,
        lastFocused: now,
    };
}

async function retrieveGivenNames(windowIds) {
    const getGivenName = windowId => browser.sessions.getWindowValue(windowId, 'givenName');
    const givenNames = await Promise.all(windowIds.map(getGivenName));
    let i = 0;
    for (const windowId of windowIds) {
        windows[windowId].givenName = givenNames[i++] || '';
    }
}

function setDefaultAndDisplayNames(windowIds) {
    for (const windowId of windowIds) {
        let name;
        do {
            name = `Window ${++lastWindowNumber}`;
        } while (nameExists(windowId, name));
        const metaWindow = windows[windowId];
        metaWindow.defaultName = name;
        metaWindow.displayName = metaWindow.givenName || name;
    }
}

export function remove(windowId) {
    delete windows[windowId];
}

// Validate and store givenName for target window.
// Automatically sets displayName.
// Returns 0 if successful, otherwise returns output of isInvalidName().
export function giveName(windowId, name = '') {
    const metaWindow = windows[windowId];
    const error = isInvalidName(windowId, name);
    if (error) return error;
    metaWindow.givenName = name;
    metaWindow.displayName = metaWindow.givenName || metaWindow.defaultName;
    browser.sessions.setWindowValue(windowId, 'givenName', name);
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
// Name that is identical to target window's givenName or defaultName: not considered conflict.
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