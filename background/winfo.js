/**
 * @see Winfo for description of winfos.
 */

import * as Storage from '../storage.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').Window} Window */
/** @typedef {import('../types.js').Winfo} Winfo */

/** Dict of keys for `sessions.getWindowValue()` mapped to default values. */
const PROPS_TO_LOAD = {
    givenName: '',
    firstSeen: 0,
    lastFocused: 0,
};

/** Dict of keys mapped to functions that derive new values, adding new properties to (i.e. mutating) `winfo`. */
const PROPS_TO_DERIVE = {
    /**
     * @param {Window} window
     * @param {Winfo} winfo
     * @modifies winfo
     */
    minimized(window, winfo) {
        winfo.minimized = window.state === 'minimized';
    },
    /**
     * Window title without Winger's title preface.
     * Basically, `givenName ? tab title : window title`.
     * Requires and gets `winfo.givenName`.
     * @param {Window} window
     * @param {Winfo} winfo
     * @param {Object} commonInfo
     * @param {number} commonInfo.nameAffixLength
     * @modifies winfo
     */
    titleSansName(window, winfo, { nameAffixLength }) {
        const { givenName } = winfo;
        winfo.titleSansName = givenName ?
            window.title.slice(givenName.length + nameAffixLength) :
            window.title;
    },
    /**
     * Requires and gets populated `window.tabs`.
     * Also adds `winfo.selectedTabCount` if window is focused.
     * @param {Window} window
     * @param {Winfo} winfo
     * @modifies winfo
     */
    tabCount(window, winfo) {
        winfo.tabCount = window.tabs.length;
        if (window.focused)
            winfo.selectedTabCount = window.tabs.filter(tab => tab.highlighted).length;
    },
};

/**
 * Given a list of wanted properties, produce winfos for all windows.
 * `windows` is optional; provide if already procured before via `browser.windows.getAll()` or similar.
 * Refer to `PROPS_TO_LOAD`, `PROPS_TO_DERIVE` and the standard window-object for available properties. `id` is always included.
 * If `title` or `titleSansName` are wanted properties, auto-removes the " — Mozilla Firefox" suffix from titles. Mutates provided `windows`.
 * @param {string[] | Set<string>} wantedProps
 * @param {Window[]} [windows]
 * @returns {Promise<Winfo[]>}
 * @modifies windows
 */
export async function getAll(wantedProps, windows = null) {
    wantedProps = new Set(wantedProps);
    wantedProps.add('id');

    const wantTitleSansName = wantedProps.has('titleSansName');
    /** @type {[string, string]?} */ let nameAffixes;

    [windows, nameAffixes] = await Promise.all([
        windows ?? browser.windows.getAll({ populate: wantedProps.has('tabs') || wantedProps.has('tabCount') }),
        wantTitleSansName && Storage.getValues(['title_preface_prefix', 'title_preface_postfix']),
    ]);

    if (wantTitleSansName)
        wantedProps.add('givenName');

     // Remove " — Mozilla Firefox" from window title
    if (wantTitleSansName || wantedProps.has('title'))
        for (const window of windows)
            window.title = removeTitleAppName(window.title);

    // Split `propsToLoad` and `propsToDerive` out of `wantedProps`, leaving behind `propsToCopy`
    // Array.push only when Set.delete succeeds
    /** @type {string[]} */ const propsToLoad = [];
    /** @type {string[]} */ const propsToDerive = [];
    for (const prop in PROPS_TO_LOAD)
        wantedProps.delete(prop) && propsToLoad.push(prop);
    for (const prop in PROPS_TO_DERIVE)
        wantedProps.delete(prop) && propsToDerive.push(prop);

    const commonInfo = {
        propsToLoad,
        propsToDerive,
        propsToCopy: wantedProps,
        nameAffixLength: nameAffixes.join?.('').length ?? 0,
    };

    return Promise.all( windows.map(window => getOne(window, commonInfo)) );
}

/**
 * @param {string} title
 * @returns {string}
 */
function removeTitleAppName(title) {
    const index = title.lastIndexOf(' — ');
    return index === -1 ? title
        : title.slice(0, index);
}

/**
 * @param {Window} window
 * @param {Object} commonInfo
 * @param {string[]} commonInfo.propsToLoad
 * @param {string[]} commonInfo.propsToDerive
 * @param {Set<string>} commonInfo.propsToCopy
 * @param {number} commonInfo.nameAffixLength
 * @returns {Promise<Winfo>}
 */
async function getOne(window, commonInfo) {
    // Load window's saved props to start winfo with
    const windowId = window.id;
    /**
     * @param {string} prop
     * @returns {Promise<[string, string]>}
     */
    const makeEntry = async prop => [ prop, (await browser.sessions.getWindowValue(windowId, prop) ?? PROPS_TO_LOAD[prop]) ];
    /** @type {[string, string][]} */
    const makingEntries = [];
    for (const prop of commonInfo.propsToLoad)
        if (prop in PROPS_TO_LOAD)
            makingEntries.push(makeEntry(prop));
    /** @type {Winfo} */
    const winfo = Object.fromEntries(await Promise.all(makingEntries));

    // Derive and add new props to winfo
    for (const prop of commonInfo.propsToDerive)
        PROPS_TO_DERIVE[prop](window, winfo, commonInfo);

    // Copy props from window to winfo
    for (const prop of commonInfo.propsToCopy)
        winfo[prop] = window[prop];

    return winfo;
}

/**
 * Split a list of winfos into the foreground/current winfo and a SORTED list of background winfos.
 * Needs winfos with `focused` and `lastFocused` properties for this to work correctly.
 * @param {Winfo[]} winfos
 * @returns {{fgWinfo: Winfo, bgWinfos: Winfo[]}}
 */
export function arrange(winfos) {
    const fgIndex = winfos.findIndex(winfo => winfo.focused);
    if (fgIndex === -1)
        throw 'Expected winfo.focused property';
    const fgWinfo = winfos.splice(fgIndex, 1)[0];
    winfos.sort((a, b) => (a.minimized - b.minimized) || (b.lastFocused - a.lastFocused));
    return {
        fgWinfo,
        bgWinfos: winfos,
    };
}

/** @param {WindowId} windowId @returns {Promise<void>} */ export const saveLastFocused = windowId => browser.sessions.setWindowValue(windowId, 'lastFocused', Date.now());
/** @param {WindowId} windowId @returns {Promise<void>} */ export const saveFirstSeen = windowId => browser.sessions.setWindowValue(windowId, 'firstSeen', Date.now());
/** @param {WindowId} windowId @returns {Promise<number?>} */ export const loadFirstSeen = windowId => browser.sessions.getWindowValue(windowId, 'firstSeen');
