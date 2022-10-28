import { winfoDict } from './window.js';
import * as Chrome from './chrome.js';

export const NO_NAME = '(no name)';
const NUMBER_POSTFIX = / (\d+)$/;

//@ (Number), state -> state
export async function restoreGiven(windowId) {
    const givenName = await browser.sessions.getWindowValue(windowId, 'givenName');
    winfoDict[windowId].givenName = givenName ? uniquify(givenName) : '';
    propagate(windowId);
}

//@ (Number), state -> (String)
export function get(windowId) {
    return winfoDict[windowId].givenName;
}

//@ (Number, String) -> state
export function set(windowId, name) {
    winfoDict[windowId].givenName = name;
    browser.sessions.setWindowValue(windowId, 'givenName', name);
    propagate(windowId);
}

// Return 0 if name is valid and unique or is blank, else return -1 or id of conflicting window.
//@ (Number, String), state -> (Boolean)
export function check(windowId, name) {
    if (name === '') return 0;
    if (isInvalid(name)) return -1;
    return has(name, windowId);
}

// Remove spaces and illegal characters from name.
//@ (String) -> (String)
export function validify(name) {
    name = name.trim();
    return isInvalid(name) ? validify(name.slice(1)) : name;
}

// If name is not unique, add number postfix to it.
// Check against all windows except window of excludeId.
//@ (String, Number), state -> (String)
export function uniquify(name, excludeId) {
    return has(name, excludeId) ? uniquify(applyNumberPostfix(name)) : name;
}

//@ (Number), state -> state
function propagate(windowId) {
    Chrome.update(windowId, get(windowId));
}

//@ (String) -> (Boolean)
function isInvalid(name) {
    return name.startsWith('/');
}

// Find window with given name, skipping window with id of excludeId.
// Return id of matching window, otherwise return 0.
//@ (String, Number), state -> (Number)
function has(name, excludeId) {
    for (const windowId in winfoDict) {
        if (windowId != excludeId && winfoDict[windowId].givenName === name)
            return windowId;
    }
    return 0;
}

// Add " 2" at the end of name, or increment an existing number postfix.
//@ (String) -> (String)
function applyNumberPostfix(name) {
    const found = name.match(NUMBER_POSTFIX);
    return found ? `${name.slice(0, found.index)} ${Number(found[1]) + 1}` : `${name} 2`;
}
