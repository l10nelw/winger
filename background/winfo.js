/*
A winfo ("window info") is similar to but distinct from a standard browser.windows window-object.
May contain as few or as many props as required; copied and/or derived from a window-object, and/or previously saved via browser.sessions.
*/

// Dict of keys for sessions.getWindowValue() mapped to default values.
const LOADABLE_PROPS = {
    givenName: '',
    firstSeen: 0,
    lastFocused: 0,
};

// Dict of keys mapped to functions that derive new values, adding new properties to (i.e. mutating) `winfo`.
//@ (Object, Object) -> state
const DERIVABLE_PROPS = {
    // Expects `window.state`
    minimized(window, winfo) {
        winfo.minimized = window.state === 'minimized';
    },
    // Expects populated `window.tabs`
    // If window is focused, also adds `winfo.selectedTabCount`
    tabCount(window, winfo) {
        winfo.tabCount = window.tabs.length;
        if (window.focused)
            winfo.selectedTabCount = window.tabs.filter(tab => tab.highlighted).length;
    },
    // Expects an active tab in `window.tabs`
    titlePreface(window, winfo) {
        const focusedTab = window.tabs.find(tab => tab.active);
        winfo.titlePreface = window.title.slice(0, window.title.indexOf(focusedTab.title));
    }
};

// Given a list of wanted properties, produce winfos containing them for all windows.
// `windows` is optional; supply it if already procured before via browser.windows.getAll() for efficiency.
// Refer to PROPS_TO_LOAD, PROPS_TO_DERIVE and the standard window-object for property candidiates. 'id' is always included.
//@ ([String], undefined|[Object]), state -> ([Object])
export async function getAll(wantedProps = [], windows = null) {
    wantedProps = new Set(wantedProps);
    wantedProps.add('id');

    const tabCountWanted = wantedProps.has('tabCount');
    const titlePrefaceWanted = wantedProps.has('titlePreface');
    if ((tabCountWanted || titlePrefaceWanted) && windows && !windows.tabs)
        throw "If 'tabCount' or 'titlePreface' properties requested, supplied windows must have tabs property";
    // 'tabCount' will populate with all tabs; if 'tabCount' absent, 'titlePreface' will populate with only focused tabs
    let focusedTabs;
    [windows, focusedTabs] = await Promise.all([
        windows || browser.windows.getAll({ populate: tabCountWanted }),
        titlePrefaceWanted && !tabCountWanted && browser.tabs.query({ active: true }),
    ]);
    if (focusedTabs)
        // Put each focusedTab in its corresponding window
        for (let index = focusedTabs.length; index--;)
            windows[index].tabs = [focusedTabs[index]];

    // Split propsToLoad and propsToDerive out of wantedProps, leaving behind "propsToCopy"
    const propsToLoad = [];
    for (const prop in LOADABLE_PROPS) {
        if (wantedProps.delete(prop))
            propsToLoad.push(prop);
    }
    const propsToDerive = [];
    for (const prop in DERIVABLE_PROPS) {
        if (wantedProps.delete(prop))
            propsToDerive.push(prop);
    }

    return Promise.all(
        windows.map(window => getOne(window, propsToLoad, propsToDerive, wantedProps))
    );
}

// Return winfos with the specified `properties`. If `windowIds` given, return only the winfos for them, otherwise return for all windows.
//@ ([String], [Number]|nil), state -> ([Object])
export async function getForExternal(properties, windowIds = null) {
    if (!Array.isArray(properties))
        return Promise.reject(new Error(`'properties' array is required`));

    const loadableProps = Object.keys(LOADABLE_PROPS);
    for (const property of properties)
        if (!loadableProps.includes(property))
            return Promise.reject(new Error(`Property '${property}' not supported`));

    if (windowIds && !windowIds.every?.(Number.isInteger))
        return Promise.reject(new Error(`'windowIds' must be an array of integers`));

    const windows = windowIds?.map(id => { id }) || await browser.windows.getAll();
    const propsToCopy = ['id'];
    return Promise.all(
        windows.map(window => getOne(window, properties, [], propsToCopy))
    );
}

//@ (Object, [String], [String], [String]|Set(String)), state -> (Object)
async function getOne(window, propsToLoad, propsToDerive, propsToCopy) {
    // Load window's saved props to start winfo with
    const windowId = window.id;
    const makeEntry = async prop => [ prop, (await browser.sessions.getWindowValue(windowId, prop) ?? LOADABLE_PROPS[prop]) ];
    const makingEntries = [];
    for (const prop of propsToLoad) {
        if (prop in LOADABLE_PROPS)
            makingEntries.push(makeEntry(prop));
    }
    const winfo = Object.fromEntries(await Promise.all(makingEntries));

    // Derive and add new props to winfo
    for (const prop of propsToDerive)
        DERIVABLE_PROPS[prop](window, winfo);

    // Copy props from window to winfo
    for (const prop of propsToCopy)
        winfo[prop] = window[prop];

    return winfo;
}

// Split a list of winfos into the current-winfo and a sorted list of other-winfos.
// Sort `otherWinfos` by `minimized` (false first) then `lastFocused` (most recent first).
// Requires winfos with `focused` and `lastFocused` properties, to work correctly.
//@ ([Object]) -> (Object, [Object])
export function arrange(winfos) {
    const currentIndex = winfos.findIndex(winfo => winfo.focused);
    if (currentIndex === -1)
        throw "Expected winfo.focused property";
    const currentWinfo = winfos.splice(currentIndex, 1)[0];
    winfos.sort((a, b) => (a.minimized - b.minimized) || (b.lastFocused - a.lastFocused));
    return {
        currentWinfo,
        otherWinfos: winfos,
    };
}

//@ (Number) -> state
export function saveLastFocused(windowId) {
    if (windowId > 0) // onFocusChanged event fires with windowId -1 when a window loses focus
        browser.sessions.setWindowValue(windowId, 'lastFocused', Date.now());
}

//@ (Number), state -> (Promise: Number|nil)
export function loadFirstSeen(windowId) {
    return browser.sessions.getWindowValue(windowId, 'firstSeen');
}

//@ (Number) -> state
export function saveFirstSeen(windowId) {
    browser.sessions.setWindowValue(windowId, 'firstSeen', Date.now());
}
