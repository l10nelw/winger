/*
A winfo ("window info") is similar to but distinct from a standard browser.windows window-object.
May contain as few or as many props as required; copied and/or derived from a window-object, and/or previously saved via browser.sessions.
*/

// Dict of keys for sessions.getWindowValue() mapped to default values.
const PROPS_TO_LOAD = {
    givenName: '',
    firstSeen: 0,
    lastFocused: 0,
};

// Dict of keys mapped to functions that derive new values, adding new properties to (i.e. mutating) `winfo`.
//@ (Object, Object) -> state
const PROPS_TO_DERIVE = {
    minimized(window, winfo) {
        winfo.minimized = window.state === 'minimized';
    },
    // Requires populated `window.tabs`
    // Also adds `winfo.selectedTabCount` if window is focused
    tabCount(window, winfo) {
        winfo.tabCount = window.tabs.length;
        if (window.focused)
            winfo.selectedTabCount = window.tabs.filter(tab => tab.highlighted).length;
    },
};

// Given a list of wanted properties, produce winfos for all windows.
// `windows` is optional; include if already procured before via browser.windows.getAll() or similar.
// Refer to PROPS_TO_LOAD, PROPS_TO_DERIVE and the standard window-object for property candidiates. 'id' is always included.
//@ ([String], undefined|[Object]), state -> ([Object])
export async function getAll(wantedProps = [], windows = null) {
    wantedProps = new Set(wantedProps);
    wantedProps.add('id');

    windows ??= await browser.windows.getAll({ populate: wantedProps.has('tabCount') });

    // Split propsToLoad and propsToDerive out of wantedProps, leaving behind "propsToCopy"
    const propsToLoad = [];
    for (const prop in PROPS_TO_LOAD) {
        if (wantedProps.delete(prop))
            propsToLoad.push(prop);
    }
    const propsToDerive = [];
    for (const prop in PROPS_TO_DERIVE) {
        if (wantedProps.delete(prop))
            propsToDerive.push(prop);
    }

    return Promise.all(
        windows.map(window => getOne(window, propsToLoad, propsToDerive, wantedProps))
    );
}

//@ (Object, [String], [String], [String]|Set(String)), state -> (Object)
async function getOne(window, propsToLoad, propsToDerive, propsToCopy) {
    // Load window's saved props to start winfo with
    const windowId = window.id;
    const makeEntry = async prop => [ prop, (await browser.sessions.getWindowValue(windowId, prop) ?? PROPS_TO_LOAD[prop]) ];
    const makingEntries = [];
    for (const prop of propsToLoad) {
        if (prop in PROPS_TO_LOAD)
            makingEntries.push(makeEntry(prop));
    }
    const winfo = Object.fromEntries(await Promise.all(makingEntries));

    // Derive and add new props to winfo
    for (const prop of propsToDerive)
        PROPS_TO_DERIVE[prop](window, winfo);

    // Copy props from window to winfo
    for (const prop of propsToCopy)
        winfo[prop] = window[prop];

    return winfo;
}

// Split a list of winfos into the current-winfo and a SORTED list of other-winfos.
// Needs winfos with `focused` and `lastFocused` properties for arrange() to work correctly.
//@ ([Object]) -> (Object, [Object])
export function arrange(winfos) {
    const currentIndex = winfos.findIndex(winfo => winfo.focused);
    if (currentIndex === -1)
        throw 'Expected winfo.focused property';
    const currentWinfo = winfos.splice(currentIndex, 1)[0];
    winfos.sort((a, b) => (a.minimized - b.minimized) || (b.lastFocused - a.lastFocused));
    return {
        currentWinfo,
        otherWinfos: winfos,
    };
}

export const focusedWindowId = {
    //@ (Number) -> state
    set(windowId) {
        browser.storage.local.set({ focusedWindowId: windowId });
    },
    //@ state -> (Number)
    async get() {
        const key = 'focusedWindowId';
        return (await browser.storage.local.get(key))[key];
    },
}

//@ (Number) -> state
export function saveLastFocused(windowId) {
    browser.sessions.setWindowValue(windowId, 'lastFocused', Date.now());
}

//@ (Number), state -> (Promise: Number|undefined)
export function loadFirstSeen(windowId) {
    return browser.sessions.getWindowValue(windowId, 'firstSeen');
}

//@ (Number) -> state
export function saveFirstSeen(windowId) {
    browser.sessions.setWindowValue(windowId, 'firstSeen', Date.now());
}
