export let windows = {};
export let focusedWindowId = null;
let lastWindowNumber = 0;
const invalidNameRegex = /^\/|['"]/;

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
        tabCount,
        number,
        defaultName,
        givenName: '',
        displayName: defaultName,
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

export function setFocused(windowId) {
    focusedWindowId = windowId;
}

export async function init(callbacks) {
    const allWindows = await browser.windows.getAll({ populate: true });
    for (const windowObject of allWindows) {
        await add(windowObject);
        const windowId = windowObject.id;
        if (windowObject.focused) focusedWindowId = windowId;
        for (const callback of callbacks) callback(windowId);
    }
}

export function saveNewNames(names, validated) {
    for (const windowId in names) {
        setName(windowId, names[windowId], validated);
    }
}

// Assign givenName for target window. Blank clears givenName.
// Validates name first, unless validated=true (do so with care).
// Automatically sets displayName.
// Returns 0 if successful, otherwise returns output of isInvalidName().
function setName(windowId, name = '', validated) {
    name = name.trim();
    const metaWindow = windows[windowId];
    const status = (!validated && name) ? isInvalidName(windowId, name) : 0;
    if (status === 0) {
        metaWindow.givenName = name;
        metaWindow.displayName = metaWindow.givenName || metaWindow.defaultName;
    }
    return status;
}

// Validate name for target window.
// Valid if unique and has no disallowed characters, or equals target's defaultName (because why not).
// Uniqueness is checked against all existing given and default names.
// Returns 0 if valid, otherwise returns -1 or id of conflicting window.
export function isInvalidName(windowId, name) {
    if (invalidNameRegex.test(name)) return -1;
    for (const id in windows) {
        const metaWindow = windows[id];
        const isNotTarget = id != windowId;
        const sameAsGiven = metaWindow.givenName === name;
        const sameAsDefault = metaWindow.defaultName === name;
        if (sameAsGiven || (sameAsDefault && isNotTarget)) {
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