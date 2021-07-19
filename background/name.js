import { winfoDict } from './window.js';
import * as Chrome from './chrome.js';

const DEFAULT_HEAD = 'Window ';
const NUMBER_POSTFIX = / (\d+)$/;
let lastWindowNumber = 0;

export async function restoreGiven(windowId) {
    const givenName = await browser.sessions.getWindowValue(windowId, 'givenName');
    winfoDict[windowId].givenName = givenName ? uniquify(givenName) : '';
    propagate(windowId);
}

export function createDefault(windowId) {
    let name;
    do {
        name = DEFAULT_HEAD + (++lastWindowNumber);
    } while (has(name, windowId));
    return name;
}

export function get(windowId) {
    const winfo = winfoDict[windowId];
    return winfo.givenName || winfo.defaultName;
}

// Validate and store givenName for target window.
// Returns 0 if successful, otherwise returns -1 or id of conflicting window.
export function set(windowId, name) {
    if (name !== '') {
        if (isInvalid(name)) return -1;
        const conflictId = has(name, windowId);
        if (conflictId) return conflictId;
    }
    winfoDict[windowId].givenName = name;
    browser.sessions.setWindowValue(windowId, 'givenName', name);
    propagate(windowId);
    return 0;
}

function propagate(windowId) {
    Chrome.update(windowId, get(windowId));
}

function isInvalid(name) {
    return name.startsWith('/');
}

// Remove spaces and illegal characters from name.
export function validify(name) {
    name = name.trim();
    return name.startsWith('/') ? validify(name.slice(1)) : name;
}

// If name is not unique, add number postfix to it.
// Check against all windows except window of excludeId.
export function uniquify(name, excludeId) {
    return has(name, excludeId) ? uniquify(applyNumberPostfix(name)) : name;
}

// Find window with given name, skipping window with id of excludeId.
// Return id of matching window, otherwise return 0.
function has(name, excludeId) {
    for (const windowId in winfoDict) {
        if (windowId == excludeId) continue;
        const winfo = winfoDict[windowId];
        if (winfo.givenName === name || winfo.defaultName === name) return windowId;
    }
    return 0;
}

// Add " 2" at the end of name, or increment an existing number postfix.
function applyNumberPostfix(name) {
    const found = name.match(NUMBER_POSTFIX);
    return found ? `${name.slice(0, found.index)} ${Number(found[1]) + 1}` : `${name} 2`;
}
