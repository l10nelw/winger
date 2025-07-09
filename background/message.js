import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as Winfo from './winfo.js';

import * as Storage from '../storage.js';
import * as Name from '../name.js';
import { isWindowId, isNodeId } from '../utils.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').TabId} TabId */
/** @typedef {import('../types.js').BNodeId} BNodeId */
/** @typedef {import('../types.js').BNode} BNode */
/** @typedef {import('../types.js').Winfo} Winfo */
/** @typedef {import('../types.js').PopupInitMessage} PopupInitMessage */
/** @typedef {import('../types.js').ActionRequest} ActionRequest */

browser.runtime.onMessage.addListener(request => onMessage(INTERNAL, request));
browser.runtime.onMessageExternal.addListener(request => onMessage(EXTERNAL, request));

/**
 * @listens browser.runtime.onMessage
 * @listens browser.runtime.onMessageExternal
 * @param {Object<string, Function>} fnCollection
 * @param {Object} message
 * @returns {Promise<any>}
 */
function onMessage(fnCollection, message) {
    /** @type {Function?} */
    const processor = fnCollection[message.type];
    return processor ?
        processor(message) :
        new Error('Missing or unrecognised message/request type');
}

/**
 * @listens browser.runtime.onMessage
 * @type {Object<string, Function>}
 */
const INTERNAL = {

    async debug() {
        const modules = {
            Action,
            Auto,
            Chrome,
            Name,
            SendMenu: await import('./menu.js'),
            Stash,
            StashProp: await import('./stash.prop.js'),
            Storage,
            Winfo,
        };
        console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
        Object.assign(globalThis, modules);
    },

    /**
     * @returns {Promise<PopupInitMessage>}
     */
    async popup() {
        /** @type {[Window[], Object<string, boolean>, boolean]} */
        let [windows, flags, allow_private] = await Promise.all([
            browser.windows.getAll({ populate: true }),
            Storage.getDict(['show_popup_bring', 'show_popup_send', 'set_title_preface', 'enable_stash', 'show_popup_stash']),
            browser.extension.isAllowedIncognitoAccess(),
        ]);
        if (Stash.Main?.nowStashing.size)
            windows = excludeByIds(windows, Stash.Main.nowStashing.values().filter(isWindowId)); // Exclude windows currently being stashed
        flags.allow_private = allow_private;
        const winfoProps = ['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'type'];
        winfoProps.push(flags.set_title_preface ? 'titleSansName' : 'title');
        if (!flags.enable_stash)
            delete flags.show_popup_stash;
        const winfos = await Winfo.getAll(winfoProps, windows);
        return { ...Winfo.arrange(winfos), flags };
    },

    /**
     * @returns {Promise<BNode[]>}
     */
    async popupStash() {
        /** @type {[boolean, BNodeId]} */
        const [enable_stash, homeId] = await Storage.getValue(['enable_stash', '_stash_home_id']);
        if (!(enable_stash && homeId))
            return [];
        let folders = await (new Stash.Main.FolderList()).populate(homeId);
        if (Stash.Main.nowStashing.size)
            folders = excludeByIds(folders, Stash.Main.nowUnstashing.values().filter(isNodeId)); // Exclude folders currently being unstashed
        return folders;
    },

    /**
     * @param {Object} request
     * @param {BNode[]} request.folders
     * @returns {Promise<BNode[]>}
     */
    popupStashContents({ folders }) {
        return (new Stash.Main.FolderList()).populate(folders[0].parentId, { bookmarkCount: true }, folders);
    },

    /**
     * @param {ActionRequest} request
     */
    action(request) {
        if (request.folderId) {
            if (request.action === 'send')
                return Stash.Main.stashSelectedTabs(request.folderId, request.remove);
            if (request.action === 'stash')
                return Stash.Main.unstashNode(request.folderId, request.remove);
        }
        if (request.action === 'stash')
            return Stash.Main.stashWindow(request.windowId, request.name, request.remove);
        return Action.execute(request);
    },

    /**
     * @param {Object} request
     * @param {string} [request.name]
     * @param {WindowId} [request.windowId]
     */
    async update({ name, windowId }) {
        Auto.switchList.reset();
        if (windowId && name)
            return Chrome.update([[windowId, name]]);
        const winfos = await Winfo.getAll(['givenName']);
        const nameMap = (new Name.NameMap()).populate(winfos);
        Chrome.update(nameMap);
    },

    /**
     * @param {Object} request
     * @param {string} request.component
     */
    clear: ({ component }) => Chrome.clear(component),

    /**
     * @param {Object} request
     * @param {boolean} request.enabled
     */
    async discardMinimized({ enabled }) {
        if (enabled) {
            for (const { id, minimized } of await Winfo.getAll(['minimized']))
                if (minimized)
                    Auto.discardWindow.schedule(id);
        } else {
            for (const { name } of await browser.alarms.getAll())
                if (name.startsWith('discardWindow'))
                    browser.alarms.clear(name);
        }
    },

    async stashInit() {
        const settings = await Storage.getDict(['enable_stash', 'stash_home_root', 'stash_home_folder']);
        await Stash.init(settings);
        Stash.Menu.init();
    },

    help: () => Action.openHelp(),

    warn: Chrome.showWarningBadge,

}

/**
 * @listens browser.runtime.onMessageExternal
 * @type {Object<string, Function>}
 */
const EXTERNAL = {

    /**
     * Return winfos with the specified `properties`.
     * If `windowIds` given, return only the winfos for them.
     * @param {Object} request
     * @param {string[]} request.properties
     * @param {WindowId[]} [request.windowIds]
     * @returns {Promise<Winfo[] | Error>}
     */
    info(request) {
        const { properties } = request;
        if (!Array.isArray(properties))
            return Promise.reject(new Error('`properties` array is required'));

        const { windowIds } = request;
        if (windowIds && !windowIds.every?.(Number.isInteger))
            return Promise.reject(new Error('`windowIds` must be an array of integers'));

        const bareWinfos = windowIds?.map(id => ({ id }));
        return Winfo.getAll(properties, bareWinfos);
    },

}

/**
 * Filter out `objects` that have the given unique `ids`, returning a new array.
 * More efficient than `ids = new Set(ids); objects.filter(o => !ids.has(o.id));`,
 * since the exclusion list shrinks until it's gone which ends the loop early.
 * @template {Window | Tab} Thing
 * @param {Thing[]} objects
 * @param {any[]} ids
 * @returns {Thing[]}
 */
function excludeByIds(objects, ids) {
    if (!ids.length)
        return objects;
    const idSet = new Set(ids);
    const included = [];
    for (let i = 0, n = objects.length; i < n; i++) {
        if (idSet.size) {
            const object = objects[i];
            if (!idSet.delete(object.id))
                included.push(object);
        } else {
            included.push(...objects.slice(i));
            break;
        }
    }
    return included;
}
