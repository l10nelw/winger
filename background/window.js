import * as Name from './name.js';

export const winfoDict = {};

export const sortedWinfos = () => Object.values(winfoDict).sort(compareLastFocused);
const compareLastFocused = (a, b) => b.lastFocused - a.lastFocused;

export async function add(windows) {
    const windowIds = [];
    for (const window of windows) {
        const windowId = window.id;
        windowIds.push(windowId);
        winfoDict[windowId] = createWinfo(window);
        winfoDict[windowId].defaultName = Name.createDefault(windowId);
    }
    await Promise.all(windowIds.map(Name.restoreGiven));
}

export function remove(windowId) {
    delete winfoDict[windowId];
}

function createWinfo({ id, incognito }) {
    return {
        id,
        incognito,
        created: Date.now(),
        lastFocused: 0,
    };
}

export function isOverOne() {
    let count = 0;
    for (const _ in winfoDict) {
        if (++count === 2) return true;
    }
    return false;
}
