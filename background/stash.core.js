// Variables, functions and classes used across the stash sub-modules.

import * as StashProp from './stash.prop.js';
import { isNodeId, isWindowId } from '../utils.js';

/** @import { WindowId, BNodeId, Window, BNode, StashFolder } from '../types.js' */
/** @import { STORED_PROPS } from '../storage.js' */

/**
 * Awaitable stash home id; allows eventual access to stash features while still initializing.
 * @type {Promise<BNodeId>}
 */
export let homeId;

/**
 * Identify the stash home's folder id based on settings. May create the folder if necessary.
 * @param {STORED_PROPS} settings
 * @returns {Promise<void>}
 */
export function init(settings) {
    homeId = initHomeId(settings);

    /**
     * @param {STORED_PROPS} settings
     * @returns {Promise<BNodeId>}
     */
    async function initHomeId({ stash_home_root_id, stash_home_folder_title }) {
        /** @type {BNodeId} */
        let id = '';
        if (stash_home_folder_title) {
            // Home is a SUBFOLDER of a root folder
            const home =
                (await getChildNodes(stash_home_root_id)).find(node => node.title === stash_home_folder_title && isFolder(node)) // Find subfolder by title
                || await createNode({ parentId: stash_home_root_id, title: stash_home_folder_title }); // Otherwise, create subfolder with title
            id = home.id;
        } else {
            // Home is a root folder
            id = stash_home_root_id;
        }
        return id;
    }
}

class NowProcessingSet extends Set {
    /**
     * Filter out items from `objects` array whose ids are in this set, returning a sub-array.
     * @template {Window[] | StashFolder[]} Things
     * @param {Things} objects - EITHER an array of windows (containing {WindowId} ids) OR an array of folders (containing {BNodeId} ids).
     * @returns {Things}
     * @this {Set<WindowId | BNodeId>}
     */
    excludeFrom(objects) {
        if (!this.size || !objects.length)
            return objects;

        // Create initial exclusion set based on type of `objects`
        /** @type {Set<WindowId> | Set<BNodeId>} */
        const excludeIdSet = new Set(this.values().filter(isWindowId(objects[0].id) ? isWindowId : isNodeId));

        // Remove items from `objects` that have ids in `excludeIdSet`
        // More efficient than `objects.filter(object => !excludeIdSet.has(object.id))` because `excludeIdSet` shrinks until empty, ending the loop early
        /** @type {Things} */
        const includedObjects = [];
        for (let i = objects.length; i--;) {
            if (excludeIdSet.size) {
                const object = objects[i];
                if (!excludeIdSet.delete(object.id))
                    includedObjects.push(object);
            } else {
                includedObjects.push(...objects.slice(i));
                break;
            }
        }
        return includedObjects;
    }
}

// Ids of windows and folders currently involved in stashing/unstashing operations
/** @type {NowProcessingSet & Set<WindowId | BNodeId>} */ export const nowStashing = new NowProcessingSet();
/** @type {NowProcessingSet & Set<WindowId | BNodeId>} */ export const nowUnstashing = new NowProcessingSet();

export class FolderList extends Array {

    /** @type {BNodeId} */ parentId;
    hasBookmarkCount = false;

    /**
     * Populate list with valid folders by providing either: a complete `nodes` array, or just their common `parentId`.
     * If the parentId is a root id, list starts after the last separator, or add a separator if none found and the list starts empty.
     * Each child folder will have `givenName` and possible `protoWindow` property from `StashProp.Window.parse()`.
     * @param {BNode[] | BNodeId} nodes_or_parentId
     * @returns {Promise<this>}
     */
    async populate(nodes_or_parentId) {
        /** @type {BNodeId} */
        const parentId = nodes_or_parentId[0]?.parentId ?? nodes_or_parentId;
        /** @type {[StashFolder[], boolean]} */
        let [nodes, allow_private] = await Promise.all([
            Array.isArray(nodes_or_parentId) ? nodes_or_parentId : getChildNodes(parentId),
            browser.extension.isAllowedIncognitoAccess(),
        ]);

        this.parentId = parentId;
        this.length = 0;

        // If parent is a root folder and `nodes` is a complete array of children, take only `nodes` after last separator
        // If no separator found, add one at the end and empty `nodes`
        if (isRootId(parentId) && nodes[0].index === 0) {
            const lastSeparator = nodes.findLast(isSeparator);
            if (lastSeparator)
                nodes = nodes.slice(lastSeparator.index + 1);
            else {
                createNode({ type: 'separator', parentId });
                nodes = [];
            }
        }

        // Filter out invalid and non-folders
        // Parse any annotations, getting `givenName` and `protoWindow` properties
        // Add `nodes` to `this`
        for (const node of nodes) {
            if (!isFolder(node))
                continue; // Skip non-folder
            const [name, protoWindow] = StashProp.Window.parse(node.title);
            if (protoWindow) {
                if (protoWindow.incognito && !allow_private)
                    continue; // Skip private-window folder if no private-window access
                node.protoWindow = protoWindow;
            }
            node.givenName = name;
            this.push(node);
        }

        return this;
    }

    /**
     * Adds `bookmarkCount` property to each folder.
     * @returns {Promise<this>}
     * @this {StashFolder[]}
     */
    async countBookmarks() {
        const nodeLists = await getFoldersChildren(this); // "Grandchildren"
        for (let i = this.length; i--;)
            this[i].bookmarkCount = nodeLists[i].filter(isBookmark).length;
        this.hasBookmarkCount = true;
        return this;
    }

    /**
     * Find folder with the given title.
     * @param {string} title
     * @return {BNode?}
     * @this {StashFolder[]}
     */
    findByTitle(title) {
        /** @type {Set<WindowId | BNodeId>} */
        const nowProcessing = nowStashing.union(nowUnstashing);
        return this.find(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
    }

    /**
     * Find bookmarkless folder with the given `title`.
     * @param {string} title
     * @return {Promise<BNode?>}
     * @this {StashFolder[]}
     */
    async findBookmarklessByTitle(title) {
        /** @type {Set<WindowId | BNodeId>} */
        const nowProcessing = nowStashing.union(nowUnstashing);

        if (this.hasBookmarkCount)
            return this.find(folder => !nowProcessing.has(folder.id) && folder.bookmarkCount === 0 && folder.givenName === title);

        // If no `bookmarkCount`, find folders matching `title` then check for any bookmarks inside
        const folders = this.filter(folder => !nowProcessing.has(folder.id) && folder.givenName === title);
        if (folders.length) {
            const nodeLists = await getFoldersChildren(folders); // "Grandchildren"
            const index = nodeLists.findIndex(nodeList => !nodeList.find(isBookmark));
            return folders[index];
        }
    }

    /**
     * Add a new folder to the start of the folderList.
     * @param {string} title
     * @returns {Promise<BNode>}
     */
    async addNew(title) {
        const parentId = this.parentId;
        const index = this[0]?.index;
        const folder = await createNode({ title, parentId, index });
        this.unshift(folder);
        return folder;
    }
}

/** @type {Set<BNodeId>} */ const ROOT_IDS = new Set(['toolbar_____', 'menu________', 'unfiled_____']);
/** @param {BNodeId} nodeId @returns {boolean} */ export const isRootId = nodeId => ROOT_IDS.has(nodeId);

/** @param {BNode} node @returns {boolean} */ export const isSeparator = node => node.type === 'separator';
/** @param {BNode} node @returns {boolean} */ export const isFolder = node => node.type === 'folder';
/** @param {BNode} node @returns {boolean} */ export const isBookmark = node => node.type === 'bookmark';

/** @param {ProtoBNode} protoNode @returns {Promise<BNode>} */ export const createNode = protoNode => browser.bookmarks.create(protoNode);
/** @param {BNodeId} nodeId @returns {Promise<void>} */ export const removeNode = nodeId => browser.bookmarks.remove(nodeId);
/** @param {BNodeId} nodeId @returns {Promise<BNode>} */ export const getNode = async nodeId => (await browser.bookmarks.get(nodeId))[0];
/** @param {BNodeId} nodeId @returns {Promise<BNode>} */ export const getTree = async nodeId => (await browser.bookmarks.getSubTree(nodeId))[0];
/** @param {BNodeId} parentId @returns {Promise<BNode[]>} */ export const getChildNodes = parentId => browser.bookmarks.getChildren(parentId);
/** @param {BNode[]} folders @returns {Promise<BNode[][]>} */ export const getFoldersChildren = folders => Promise.all(folders.map(({ id }) => getChildNodes(id)));
