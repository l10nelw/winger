import { isInvalid } from './name.js';
import * as Title from './title.js';
let Badge;

export const windowMap = {};
export const defaultNameHead = 'Window ';
export let windowCount = 0;
let lastWindowNumber = 0;

export const sorted = () => Object.values(windowMap).sort(compareLastFocused);
const compareLastFocused = (a, b) => b.lastFocused - a.lastFocused;

export async function init(SETTINGS, windows) {
    if (SETTINGS.show_badge) Badge = await import('./badge.js');

    // Perform equivalent of add() for every open window all at once.
    let windowIds = [];
    for (const window of windows) {
        const windowId = window.id;
        windowIds.push(windowId);
        windowMap[windowId] = createMetaWindow(window);
        windowCount++;
    }
    await nameMetaWindows(windowIds);
}

export async function add(window) {
    const windowId = window.id;
    if (windowId in windowMap) return;
    windowMap[windowId] = createMetaWindow(window);
    windowCount++;
    await nameMetaWindows([windowId]);
}

export function remove(windowId) {
    delete windowMap[windowId];
    windowCount--;
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
    for (const windowId of windowIds) {
        windowMap[windowId].defaultName = createDefaultName(windowId);
        onWindowNamed(windowId);
    }
}

async function restoreGivenName(windowId) {
    const givenName = await browser.sessions.getWindowValue(windowId, 'givenName');
    windowMap[windowId].givenName = givenName || '';
}

function createDefaultName(windowId) {
    let name;
    do {
        name = defaultNameHead + (++lastWindowNumber);
    } while (hasName(name, windowId));
    return name;
}

export function getName(windowId) {
    const metaWindow = windowMap[windowId];
    return metaWindow.givenName || metaWindow.defaultName;
}

// Validate and store givenName for target window.
// Returns 0 if successful, otherwise returns -1 or id of conflicting window.
export function giveName(windowId, name = '') {
    if (isInvalid(name)) return -1;
    const conflictId = hasName(name, windowId);
    if (conflictId) return conflictId;
    windowMap[windowId].givenName = name;
    browser.sessions.setWindowValue(windowId, 'givenName', name);
    onWindowNamed(windowId);
    return 0;
}

// Check if name conflicts with any windows, except with given excludeId.
// Returns id of conflicting window, otherwise returns 0.
export function hasName(name, excludeId) {
    for (const id in windowMap) {
        if (id == excludeId) continue;
        const metaWindow = windowMap[id];
        if (metaWindow.givenName === name || metaWindow.defaultName === name) return id;
    }
    return 0;
}

function onWindowNamed(windowId) {
    Title.update(windowId);
    Badge?.update(windowId);
}