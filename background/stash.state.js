import { GroupMap } from '../utils.js';

const NON_CONTAINER_ID = 'firefox-default'; // TODO: what about private windows?

const WINDOW_PROP_TO_WRITE = {
    private: (window) => window.incognito ? { private: true } : null,
}
const WINDOW_PROP_TO_READ = {
    private: (incognito) => ({ incognito }),
}
const TAB_PROP_TO_WRITE = {
    id:        (tab, folderId) => tab.isParent ? { id: folderId + tab.id } : null, // Needed for 'parent' to be useful
    parentId:  (tab, folderId) => tab.openerTabId ? { parentId: folderId + tab.openerTabId } : null,
    focused:   (tab) => tab.active ? { focused: true } : null,
    pinned:    (tab) => tab.pinned ? { pinned: true } : null,
    container: (tab, _, containerDict) => containerDict && tab.cookieStoreId !== NON_CONTAINER_ID ?
                    { container: containerDict[tab.cookieStoreId] } : null,
}
const TAB_PROP_TO_READ = {
    id:        (stashedId) => ({ stashedId }),
    parentId:  (stashedParentId) => ({ stashedParentId }),
    focused:   (active) => ({ active }),
    pinned:    (pinned) => ({ pinned }),
    container: (container) => ({ container }),
}

// Find valid json string at end of the title, then parse and translate via a propDict to produce a protoTab/protoWindow.
// Return nothing if json not found or invalid.
//@ (String, Object) -> (Object|undefined)
function findAndParseJson(title, propDict) {
    title = title.trim();
    if (title.at(-1) !== '}')
        return;
    const jsonIndex = title.lastIndexOf('{'); // TODO: handle '{' in title
    if (jsonIndex === -1)
        return;
    let state;
    try {
        state = JSON.parse(title.slice(jsonIndex));
    } catch {
        return;
    }
    const protoThing = {};
    for (const [key, value] of Object.entries(state))
        Object.assign(protoThing, propDict[key]?.(value));
    return protoThing;
}

export const Window = {

    // Produce bookmark folder title that encodes window state.
    // Title may contain both window name and state, one of them, or neither (empty string).
    //@ (Object) -> (String)
    stringify(winfo) {
        const state = {};
        let hasState = false;
        for (const key in WINDOW_PROP_TO_WRITE) if (key in winfo) {
            const stateProp = WINDOW_PROP_TO_WRITE[key](winfo[key]);
            if (stateProp) {
                Object.assign(state, stateProp);
                hasState = true;
            }
        }
        return [
            winfo.givenName,
            hasState ? JSON.stringify(state) : null,
        ].filter(Boolean).join(' ');
    },

    // Produce protoWindow from bookmark folder title.
    //@ (String) -> (Object|undefined)
    parse(title) {
        return findAndParseJson(title, WINDOW_PROP_TO_READ) || { givenName: title };
    },

}

export const Tab = {

    // Produce bookmark title that encodes tab state.
    //@ (Object, String, Object) -> (String)
    stringify(tab, folderId, containerDict) {
        const state = {};
        for (const key in TAB_PROP_TO_WRITE)
            if (key in tab)
                Object.assign(state, TAB_PROP_TO_WRITE[key](tab, folderId, containerDict));
        const title = `${tab.title} ${JSON.stringify(state)}`;
        return title;
    },

    // Produce protoTab from bookmark title.
    //@ (String) -> (Object|undefined)
    parse(title) {
        return findAndParseJson(title, TAB_PROP_TO_READ) || { title };
    },

}

export const Containers = {

    // Produce containerDict (id:name) for use in State.tab.stringify().
    //@ ([Object]) -> (Object)
    async getDict(tabs) {
        if (!browser.contextualIdentities)
            return;

        // Find any container ids among tabs
        const containerIdSet = new Set();
        tabs.forEach(tab => containerIdSet.add(tab.cookieStoreId));
        containerIdSet.delete(NON_CONTAINER_ID);
        if (!containerIdSet.size)
            return;

        // Get container names
        const containerIdNameDict = Object.fromEntries(
            (await Promise.all( [...containerIdSet].map(getContainerName) )).filter(Boolean)
        );
        return containerIdNameDict;
    },

    // Update protoTabs with cookieStoreId based on container name if any.
    //@ ([Object]), state -> state
    async restore(protoTabs) {
        if (!browser.contextualIdentities)
            return;

        // Find any containers and note protoTabs that belong to each container
        const containerNameIndexMap = new GroupMap();
        protoTabs.forEach((protoTab, index) => {
            if (protoTab.container)
                containerNameIndexMap.group(protoTab.container, index);
        });
        if (!containerNameIndexMap.size)
            return;

        // Get cookieStoreIds, creating new containers if needed
        const names = [...containerNameIndexMap.keys()];
        const containerNameIdDict = Object.fromEntries(
            (await Promise.all( names.map(getContainerId) )).filter(Boolean)
        );

        // Assign correct cookieStoreId to each container's protoTabs
        for (const [name, indexes] of containerNameIndexMap.entries()) {
            const containerId = containerNameIdDict[name];
            for (const index of indexes)
                protoTabs[index].cookieStoreId = containerId;
        }
    },

}

// Find container of the given id and return [id, name] if found.
//@ (String), state -> ([String, String]|undefined)
async function getContainerName(cookieStoreId) {
    try {
        const container = await browser.contextualIdentities.get(cookieStoreId);
        if (container)
            return [cookieStoreId, container.name];
    } catch {}
}

// Find container matching the given name, creating one if not found, and return [name, id].
//@ (String), state -> ([String, String]), state|nil
async function getContainerId(name) {
    try {
        const container = (
            await browser.contextualIdentities.query({ name }))[0] ||
            await browser.contextualIdentities.create({ name, color: 'toolbar', icon: 'circle' }
        );
        if (container)
            return [name, container.cookieStoreId];
    } catch {}
}

// Before creating bookmarks, collect tabs to add metadata first.
// Map tabId -> tab
export class StashingTabMap extends Map {
    //@ [Object] -> state
    populate(tabs) {
        for (const tab of tabs)
            this.set(tab.id, tab);
        return this;
    }

    // After map is populated, mark tabs as 'parents' if other tabs point to them as such.
    //@ state -> state
    markParents() {
        for (const { openerTabId } of this.values())
            if (this.has(openerTabId))
                this.get(openerTabId).isParent = true;
    }
}

// After tabs are created, this map links them to their protoTabs.
// Map stashedId -> { id, stashedParentId }
export class UntashingTabMap extends Map {
    // Given a tab and associated protoTab, map stashedId to true id and stashedParentId.
    //@ (Object, Object) -> state
    set(tab, protoTab) {
        const { id } = tab;
        const { stashedId, stashedParentId } = protoTab;
        super.set(stashedId || id, { id, stashedParentId }); // Key doesn't matter, just use id if missing stashedId
    }

    // After map is populated, restore tabs' openerTabIds where applicable.
    //@ state -> state
    restoreParents() {
        for (const { id, stashedParentId } of this.values()) if (stashedParentId) {
            const openerTabId = this.get(stashedParentId).id;
            if (openerTabId)
                browser.tabs.update(id, { openerTabId });
        }
    }
}
