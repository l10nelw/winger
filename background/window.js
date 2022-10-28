import * as Name from './name.js';

export const winfoDict = {};

export const sortedWinfos = () => Object.values(winfoDict).sort(compareLastFocused); //@ state -> ([Object])
const compareLastFocused = (a, b) => b.lastFocused - a.lastFocused; //@ (Number, Number) -> (Number)

//@ ([Object]) -> state
export async function add(windows) {
    const windowIds = [];
    for (const window of windows) {
        const windowId = window.id;
        windowIds.push(windowId);
        winfoDict[windowId] = createWinfo(window);
    }
    await Promise.all(windowIds.map(Name.restoreGiven));
}

//@ (Number), state -> state
export function remove(windowId) {
    delete winfoDict[windowId];
}

//@ ({ Number, Boolean }) -> (Object)
function createWinfo({ id, incognito }) {
    return {
        id,
        incognito,
        created: Date.now(),
        lastFocused: 0,
    };
}

//@ state -> (Boolean)
export function isOverOne() {
    let count = 0;
    for (const _ in winfoDict) {
        if (++count === 2) return true;
    }
    return false;
}
