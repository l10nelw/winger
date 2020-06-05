export const windowMap = {};
export const focusedWindow = { id: null };
export const lastDetach = {
    set(tabId = null, oldWindowId = null) {
        this.tabId = tabId;
        this.oldWindowId = oldWindowId;
    }
};
const invalidCharsNameRegex = /^\//;
let lastWindowNumber = 0;

// Perform equivalent of add() for every open window all at once.
export async function init(windowObjects) {
    lastDetach.set();
    let windowIds = [];
    for (const windowObject of windowObjects) {
        const windowId = windowObject.id;
        windowIds.push(windowId);
        windowMap[windowId] = createMetaWindow(windowObject);
    }
    await nameMetaWindows(windowIds);
}

export async function add(windowObject) {
    const windowId = windowObject.id;
    if (windowId in windowMap) return;
    windowMap[windowId] = createMetaWindow(windowObject);
    await nameMetaWindows([windowId]);
}

export function remove(windowId) {
    delete windowMap[windowId];
}

function createMetaWindow({ id, incognito }) {
    return {
        id,
        incognito,
        created: Date.now(),
        lastFocused: 0,
    };
}

async function nameMetaWindows(windowIds) {
    await Promise.all(windowIds.map(restoreGivenName));
    windowIds.forEach(windowId => windowMap[windowId].defaultName = createDefaultName(windowId));
}

async function restoreGivenName(windowId) {
    const givenName = await browser.sessions.getWindowValue(windowId, 'givenName');
    windowMap[windowId].givenName = givenName || '';
}

function createDefaultName(windowId) {
    let name;
    do {
        name = `Window ${++lastWindowNumber}`;
    } while (nameExists(windowId, name));
    return name;
}

export function getName(windowId) {
    const metaWindow = windowMap[windowId];
    return metaWindow.givenName || metaWindow.defaultName;
}

// Validate and store givenName for target window.
// Returns 0 if successful, otherwise returns output of isInvalidName().
export function giveName(windowId, name = '') {
    const metaWindow = windowMap[windowId];
    const error = isInvalidName(windowId, name);
    if (error) return error;
    metaWindow.givenName = name;
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
    for (const id in windowMap) {
        if (id == windowId) continue;
        const metaWindow = windowMap[id];
        if (metaWindow.givenName == name || metaWindow.defaultName == name) {
            return metaWindow.id;
        }
    }
    return 0;
}
