import { GroupMap } from '../utils.js';

const PREFACE = '/ｗ?';
const NON_CONTAINER_ID = 'firefox-default';


/* --- STASH --- */

const propToParam = {
    active:         (boolean) => boolean ? 'focused' : null,
    pinned:         (boolean) => boolean ? 'pinned' : null,
    id:             (tabId, { folderId }) => `id=${folderId}${tabId}`, // Mandatory for "parent=" to be useful
    openerTabId:    (tabId, { folderId }) => tabId ? `parent=${folderId}${tabId}` : null,
    cookieStoreId:  (containerId, { containerDict }) =>
                        containerDict && (containerId !== NON_CONTAINER_ID) ? `container=${containerDict[containerId]}` : null,
};

// Produce bookmark title that encodes tab state.
export function writeTabTitle(tab, folderId, containerDict) {
    const parameters = [];
    const helperDict = { folderId, containerDict };
    for (const prop in propToParam) if (prop in tab) {
        const parameter = propToParam[prop](tab[prop], helperDict);
        if (parameter) parameters.push(parameter);
    }
    const statefulTitle = `${tab.title}    ${PREFACE}${parameters.join('&')}`;
    // Mandatory PREFACE resolves most cases where PREFACE exists in original title
    return statefulTitle;
}

// Produce containerIdNameDict for use in writeTabTitle().
export async function getContainerDict(tabs) {

    // Find any containers used among tabs
    const containerIds = new Set();
    tabs.forEach(tab => containerIds.add(tab.cookieStoreId));
    containerIds.delete(NON_CONTAINER_ID);

    // Get all relevant container names at once
    const containerIdNameDict = Object.fromEntries(
        (await Promise.all(
            [...containerIds].map(getContainerIdName)
        ))
        .filter(Boolean)
    );

    return containerIdNameDict;
}

async function getContainerIdName(cookieStoreId) {
    const container = await browser.contextualIdentities.get(cookieStoreId).catch(() => null);
    if (container) return [cookieStoreId, encodeURIComponent(container.name)];
}


/* --- UNSTASH --- */

const paramToProp = {
    pinned:    () => ({ pinned: true }),
    focused:   () => ({ active: true }),
    id:        (stashedId) => ({ stashedId }),
    parent:    (stashedId) => ({ stashedParentId: stashedId }),
    container: (containerName) => ({ container: containerName }),
};

// Get properties, including state, for tab creation (a protoTab).
export function readTitle(title) {
    const prefaceIndex = title.lastIndexOf(PREFACE); // Find last occurence in case PREFACE also exists in original title
    if (prefaceIndex === -1) return;

    const properties = { title: title.slice(0, prefaceIndex).trim() };

    const parameters = title.slice(prefaceIndex + PREFACE.length).split('&');
    for (const parameter of parameters) {
        const [paramKey, paramValue] = parameter.split('=');
        if (!(paramKey in paramToProp)) continue;
        Object.assign( properties, paramToProp[paramKey](paramValue) );
    }

    return properties;
}

// In protoTabs, convert container names to cookieStoreIds.
export async function restoreContainers(protoTabs) {

    // Find any containers and note protoTabs that belong to each container
    const containerNameIndexMap = new GroupMap();
    protoTabs.forEach((protoTab, index) => {
        const name = protoTab.container;
        if (name) containerNameIndexMap.group(index, name);
    });

    // Get all relevant cookieStoreIds at once
    const containerNameIdDict = Object.fromEntries(
        (await Promise.all(
            [...containerNameIndexMap.keys()].map(getContainerNameId)
        ))
        .filter(Boolean)
    );

    // Assign correct cookieStoreId to each container's protoTabs
    for (const [name, indexes] of containerNameIndexMap.entries()) {
        const containerId = containerNameIdDict[name];
        for (const i of indexes) {
            protoTabs[i].cookieStoreId = containerId;
        }
    }
}

async function getContainerNameId(name) {
    try {
        const container =
            (await browser.contextualIdentities.query({ name: decodeURIComponent(name) }))[0] ||
            await browser.contextualIdentities.create({ name, color: 'toolbar', icon: 'circle' });
        return [name, container.cookieStoreId];
    } catch {}
}


/* --- UNSTASH: Restore tabs' openerTabId --- */

export class UntashedTabMap extends Map {

    addTab(tab, protoTab) {
        const { id } = tab;
        const { stashedId, stashedParentId } = protoTab;
        this.set((stashedId || id), { id, stashedParentId }); // Key doesn't matter, just use id if missing stashedId ("id=")
    }

    restoreParents() {
        for (const { id, stashedParentId } of this.values()) {
            if (!stashedParentId) continue;
            const openerTabId = this.get(stashedParentId).id;
            if (openerTabId) browser.tabs.update(id, { openerTabId });
        }
        this.clear();
    }
}
