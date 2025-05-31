
/*
StashProp module - Encode and decode tab/window properties into and from JSON annotations in folder/bookmark titles.
Example JSON annotation: '{"pinned":true,"id":"abcdef123","parentId":"uvwxyz789","container":"Personal"}'
Stash procedure:
- folderTitle = StashProp.Window.stringify(name, window)
- Create folder
- await StashProp.Tab.prepare(tabs)
- bookmarkTitle = StashProp.Tab.stringify(tab, folderId)
- Create bookmarks
Unstash procedure:
- [name, protoWindow] = StashProp.Window.parse(folderTitle)
- Create window
- protoTab = StashProp.Tab.parse(bookmarkTitle)
- await StashProp.Tab.preOpen(protoTabs, window)
- safeProtoTab = StashProp.Tab.scrub(protoTab) - remove properties unsupported by browser.tabs.create()
- Create tabs with safeProtoTabs
- StashProp.Tab.postOpen(tabs, protoTabs)
*/

import { GroupMap } from '../utils.js';
import { restoreTabRelations } from './action.auto.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').TabId} TabId */
/** @typedef {import('../types.js').NodeId} NodeId */
/** @typedef {import('../types.js').Window} Window */
/** @typedef {import('../types.js').Tab} Tab */
/** @typedef {import('../types.js').Node} Node */
/** @typedef {import('../types.js').ProtoWindow} ProtoWindow */
/** @typedef {import('../types.js').ProtoTab} ProtoTab */

/**
 * @param {NodeId} folderId
 * @param {TabId} tabId
 * @returns {string}
 */
const makeStashId = (folderId, tabId) => folderId.slice(0, 5) + tabId;

/** Write and read window/tab properties. Only truthy properties are written. */
const Props = {

    // Define annotation-property writer and reader functions here.
    WINDOW: {
        /** @type {Object<string, (thing: Window) => any>} */
        writer: {
            private: ({ incognito }) => incognito, // 'private' alias of 'incognito'; Firefox users are more familiar with the former
        },
        /** @type {Object<string, (thing: ProtoWindow) => any>} */
        reader: {
            incognito: parsed => parsed.private || parsed.incognito, // Either 'private' or 'incognito' accepted
        },
    },
    TAB: {
        /** @type {Object<string, (thing: Tab, [folderId]: NodeId) => any>} */
        writer: {
            active: ({ active, index }) => index && active,
            muted:  ({ mutedInfo: { muted } }) => muted,
            pinned: ({ pinned }) => pinned,
            // After Containers.prepare():
            container: ({ container }) => container,
            // After Parents.prepare():
            id: ({ id, isParent }, folderId) => isParent && makeStashId(folderId, id),
            parentId: ({ openerTabId }, folderId) => openerTabId && makeStashId(folderId, openerTabId), // 'parentId' alias of 'openerTabId'
        },
        /** @type {Object<string, (thing: ProtoTab) => any>} */
        reader: {
            active: ({ active }) => active,
            muted:  ({ muted }) => muted,
            pinned: ({ pinned }) => pinned,
            // Before Container.restore():
            container: ({ container }) => container,
            // Before Parents.restore():
            id: ({ id }) => id,
            openerTabId: ({ parentId, openerTabId }) => parentId || openerTabId, // Either 'parentId' or 'openerTabId' accepted
        },
    },

    /**
     * @param {Window | Tab} thing
     * @param {Object} fnCollection
     * @param {Object<string, Function>} fnCollection.writer
     * @param {NodeId} [folderId]
     * @returns {Object}
     */
    write(thing, { writer }, folderId = '') {
        const toStringify = {};
        for (const key in writer) {
            const value = writer[key](thing, folderId);
            if (value) // Only write property if it's truthy
                toStringify[key] = value;
        }
        return toStringify;
    },

    /**
     * @param {Object<string, any>} parsed
     * @param {Object} fnCollection
     * @param {Object<string, Function>} fnCollection.reader
     * @returns {ProtoWindow | ProtoTab}
     */
    read(parsed, { reader }) {
        /** @type {ProtoWindow | ProtoTab} */
        const protoThing = {};
        for (const key in reader) {
            const value = reader[key](parsed);
            if (value)
                protoThing[key] = value;
        }
        return protoThing;
    },

}

/**
 * @param {Tab} tab
 * @returns {boolean}
*/
const isContainered = tab => !NON_CONTAINER_ID_SET.has(tab.cookieStoreId);
const NON_CONTAINER_ID_SET = new Set(['firefox-default', 'firefox-private']);

const Containers = {

    /**
     * Mark containered tabs with a `container: 'container-name'` property.
     * @param {Tab[]} tabs
     * @modifies tabs
     */
    async prepare(tabs) {
        if (!browser.contextualIdentities)
            return;

        // Find container ids among tabs to build Map(containerId: tabArray)
        /** @type {Map<string, Tab[]>} */
        const containerIdTabMap = new GroupMap();
        for (const tab of tabs) if (isContainered(tab))
            containerIdTabMap.group(tab.cookieStoreId, tab);

        if (!containerIdTabMap.size)
            return;

        // Get container names to build {cookieStoreId: containerName} dict
        /** @type {Object<string, string>} */
        const containerIdNameDict = Object.fromEntries(
            (await Promise.all(
                [...containerIdTabMap.keys()].map(Containers._getIdNamePair)
            )).filter(Boolean)
        );
        // Assign container names to tabs
        for (const [containerId, tabs] of containerIdTabMap) {
            const containerName = containerIdNameDict[containerId];
            for (const tab of tabs)
                tab.container = containerName;
        }
    },

    /**
     * Replace any container properties in protoTabs with cookieStoreId.
     * @param {ProtoTab[]} protoTabs
     * @param {Window} window - For checking incognito state
     * @modifies protoTabs
     */
    async restore(protoTabs, window) {
        // If window is private or container feature is disabled, forget container properties
        if (window.incognito || !browser.contextualIdentities) {
            for (const protoTab of protoTabs)
                delete protoTab.container;
            return;
        }

        // Find container names among protoTabs to build Map<containerName, protoTabArray>
        /** @type {Map<string, ProtoTab[]>} */
        const containerNameTabMap = new GroupMap();
        for (const protoTab of protoTabs) if (protoTab.container) {
            containerNameTabMap.group(protoTab.container, protoTab);
            delete protoTab.container;
        }
        if (!containerNameTabMap.size)
            return;

        // Get cookieStoreIds to build a {containerName: cookieStoreIds} dict
        // Create new containers if needed
        /** @type {Object<string, string>} */
        const containerNameIdDict = Object.fromEntries(
            (await Promise.all(
                [...containerNameTabMap.keys()].map(Containers._getNameIdPair)
            )).filter(Boolean)
        );

        // Assign cookieStoreId to protoTabs
        for (const [containerName, protoTabs] of containerNameTabMap.entries()) {
            const cookieStoreId = containerNameIdDict[containerName];
            for (const protoTab of protoTabs)
                protoTab.cookieStoreId = cookieStoreId;
        }
    },

    /**
     * Find container of the given id and return [id, name] if found.
     * @param {string} id
     * @returns {Promise<[string, string]?>}
     */
    async _getIdNamePair(id) {
        try {
            const container = await browser.contextualIdentities.get(id);
            if (container)
                return [id, container.name];
        } catch {}
    },

    /**
     * Find container matching the given name, creating one if not found, and return [name, id].
     * @param {string} name
     * @returns {Promise<[string, string]?>}
     */
    async _getNameIdPair(name) {
        try {
            const container =
                (await browser.contextualIdentities.query({ name }))[0] ||
                await browser.contextualIdentities.create({ name, color: 'toolbar', icon: 'circle' });
            if (container)
                return [name, container.cookieStoreId];
        } catch {}
    },

}

const Parents = {

    /**
     * Mark tabs that are parents of other tabs with the isParent=true property.
     * Remove references to any parents that are not in the list of tabs.
     * @param {Tab[]} tabs
     * @modifies tabs
     */
    prepare(tabs) {
        /** @type {Map<number, Tab>} */
        const tabMap = new Map();
        for (const tab of tabs)
            tabMap.set(tab.id, tab);
        for (const tab of tabs) {
            const parentTab = tabMap.get(tab.openerTabId);
            if (parentTab && parentTab.id !== tab.id)
                parentTab.isParent = true;
            else
                delete tab.openerTabId;
        }
    },

    /**
     * Return shallow copy of protoTab sans id and openerTabId properties.
     * @param {ProtoTab} protoTab
     * @returns {ProtoTab}
     */
    scrub(protoTab) {
        const safeProtoTab = { ...protoTab };
        delete safeProtoTab.id;
        delete safeProtoTab.openerTabId;
        return safeProtoTab;
    },

    /**
     * @param {Tab[]} tabs
     * @param {ProtoTab[]} protoTabs
     * @modifies tabs
     */
    restore(tabs, protoTabs) {
        restoreTabRelations(tabs, protoTabs);
    },

}

/**
 * Find valid JSON string at end of the title, split it off, and parse the JSON.
 * Return [cleaned title, result object], or [title, null] if JSON not found or invalid.
 * @param {string} title
 * @returns {[string, Object?]}
 */
function parseTitleJSON(title) {
    title = title.trim();
    if (title.at(-1) !== '}')
        return [title, null];

    // Extract JSON, retry with larger slices upon failure if more curly brackets found
    /** @type {Object?} */ let parsed;
    /** @type {number} */ let index = Infinity;
    do {
        index = title.lastIndexOf('{', index - 1);
        if (index === -1)
            return [title, null];
        try {
            parsed = JSON.parse(title.slice(index));
        } catch {}
    } while (!parsed);

    title = title.slice(0, index).trim();
    return [title, parsed];
}

export const Window = {

    // Stashing

    /**
     * Produce a bookmark folder title that encodes window properties. Title may contain both window name and properties, one of them, or neither (empty string).
     * @param {string} name
     * @param {Window} window
     * @returns {string}
     */
    stringify(name, window) {
        const props = Props.write(window, Props.WINDOW);
        const annotation = Object.keys(props).length ?
            JSON.stringify(props) : '';
        return `${name} ${annotation}`.trim();
    },

    // Unstashing

    /**
     * Produce [cleaned title, protoWindow] from bookmark folder title. A protoWindow is an info object for `browser.window.create()`.
     * If no properties found, return [original title, null].
     * @param {string} title
     * @returns {[string, ProtoWindow?]}
     */
    parse(title) {
        const [name, parsed] = parseTitleJSON(title);
        /** @type {ProtoWindow} */
        const protoWindow = parsed ?
            Props.read(parsed, Props.WINDOW) : null;
        // browser.window.create() rejects unsupported properties, so return name and protoWindow separately
        return [name, protoWindow];
    },

}

export const Tab = {

    // Stashing

    /**
     * Add properties to tabs marking containers and parents. To be done before creating bookmarks.
     * @param {Tab[]} tabs
     * @modifies tabs
     */
    async prepare(tabs) {
        await Containers.prepare(tabs);
        Parents.prepare(tabs);
    },

    /**
     * Produce bookmark title that encodes tab properties.
     * @param {Tab} tab
     * @param {NodeId} folderId
     */
    stringify(tab, folderId) {
        const props = Props.write(tab, Props.TAB, folderId);
        const annotation = Object.keys(props).length ?
            JSON.stringify(props) : '';
        return `${tab.title ?? ''} ${annotation}`.trim();
    },

    // Unstashing

    /**
     * Produce protoTab from bookmark title if properties found.
     * @param {string} title
     * @returns {ProtoTab}
     */
    parse(title) {
        const [actualTitle, parsed] = parseTitleJSON(title);
        /** @type {ProtoTab} */
        const protoTab = { title: actualTitle };
        if (parsed)
            Object.assign(protoTab, Props.read(parsed, Props.TAB));
        return protoTab;
    },

    /**
     * Tasks before creating tabs.
     * @param {ProtoTab[]} protoTabs
     * @param {Window} window
     * @modifies protoTabs
     */
    async preOpen(protoTabs, window) {
        await Containers.restore(protoTabs, window);
    },

    /**
     * Return modified copy of protoTab that is safe to create a tab with.
     * @param {ProtoTab} protoTab
     * @returns {ProtoTab}
     */
    scrub(protoTab) {
        return Parents.scrub(protoTab);
    },

    /**
     * Tasks after creating tabs.
     * @param {Tab[]} tabs
     * @param {ProtoTab[]} protoTabs
     * @modifies tabs
     */
    postOpen(tabs, protoTabs) {
        Parents.restore(tabs, protoTabs);
    },

}
