import * as Name from './name.js';

export const winfoDict = {};

export const lastFocused = {
    id: 0,
    //@ (Number) -> state
    save(windowId) {
        if (windowId > 0) {
            lastFocused.id = windowId;
            browser.sessions.setWindowValue(windowId, 'lastFocused', Date.now());
        }
    },
    // Add lastFocused prop to each winfo in given array.
    //@ ([Object]), state -> (Promise: [Object]), state
    load(winfos) {
        return Promise.all(
            winfos.map(async winfo => {
                winfo.lastFocused = await browser.sessions.getWindowValue(winfo.id, 'lastFocused') ?? 0;
                return winfo;
            })
        );
    },
};

export const createdAt = {
    //@ (Number) -> state
    async set(windowId) {
        if (!await browser.sessions.getWindowValue(windowId, 'createdAt'))
            browser.sessions.setWindowValue(windowId, 'createdAt', Date.now());
    },
};

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

// Return current-winfo and an other-winfo array sorted by lastFocused descending.
//@ state -> (Object, [Object])
export async function sortedWinfos() {
    const currentWindowId = lastFocused.id;
    const currentWinfo = winfoDict[currentWindowId];
    const otherWinfos = [];
    for (const windowId in winfoDict)
        if (windowId != currentWindowId)
            otherWinfos.push(winfoDict[windowId]);

    await lastFocused.load(otherWinfos);
    otherWinfos.sort((a, b) => b.lastFocused - a.lastFocused);

    return { currentWinfo, otherWinfos };
}