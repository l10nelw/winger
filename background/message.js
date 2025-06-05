import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';
import { isWindowId, isFolderId } from '../utils.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').TabId} TabId */
/** @typedef {import('../types.js').NodeId} NodeId */
/** @typedef {import('../types.js').Node} Node */

browser.runtime.onMessage.addListener(request => INTERNAL[request.type]?.(request));
browser.runtime.onMessageExternal.addListener(onExternalMessage);

/**
 * @namespace INTERNAL
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
            SendMenu: await import('./menu.send.js'),
            Stash,
            StashMenu: await import('./menu.stash.js'),
            StashProp: await import('./stash.prop.js'),
            Storage,
            Winfo,
        };
        console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
        Object.assign(globalThis, modules);
    },

    /**
     * @returns {Promise<{ fgWinfo: Object, bgWinfos: Object[], flags: Object<string, boolean> }>}
     */
    async popup() {
        /** @type {[Object[], Object<string, boolean>, boolean]} */
        let [windows, flags, allow_private] = await Promise.all([
            browser.windows.getAll({ populate: true }),
            Storage.getDict(['show_popup_bring', 'show_popup_send', 'set_title_preface', 'enable_stash', 'show_popup_stash']),
            browser.extension.isAllowedIncognitoAccess(),
        ]);
        if (Stash.nowStashing.size)
            windows = excludeByIds(windows, Stash.nowStashing.values().filter(isWindowId)); // Exclude windows currently being stashed
        flags.allow_private = allow_private;
        const winfoProps = ['focused', 'givenName', 'incognito', 'lastFocused', 'minimized', 'tabCount', 'type'];
        winfoProps.push(flags.set_title_preface ? 'titleSansName' : 'title');
        if (!flags.enable_stash)
            delete flags.show_popup_stash;
        const winfos = await Winfo.getAll(winfoProps, windows);
        return { ...Winfo.arrange(winfos), flags };
    },

    /**
     * @returns {Promise<Node[]>}
     */
    async popupStash() {
        /** @type {[boolean, NodeId]} */
        const [enable_stash, homeId] = await Storage.getValue(['enable_stash', '_stash_home_id']);
        if (!(enable_stash && homeId))
            return [];
        let folders = await (new Stash.FolderList()).populate(homeId);
        if (Stash.nowStashing.size)
            folders = excludeByIds(folders, Stash.nowUnstashing.values().filter(isFolderId)); // Exclude folders currently being unstashed
        return folders;
    },

    /**
     * @param {Object} request
     * @param {Node[]} request.folders
     * @returns {Promise<Node[]>}
     */
    popupStashContents({ folders }) {
        return (new Stash.FolderList()).populate(folders[0].parentId, { bookmarkCount: true }, folders);
    },

    /**
     * @param {Object} request
     * @param {string} [request.argument]
     * @param {NodeId} [request.folderId]
     * @param {string} [request.name]
     * @param {boolean} [request.remove]
     * @param {boolean} [request.sendToMinimized]
     * @param {WindowId} [request.windowId]
     */
    action(request) {
        if (request.folderId) {
            if (request.action === 'send')
                return Stash.stashSelectedTabs(request.folderId, request.remove);
            if (request.action === 'stash')
                return Stash.unstashNode(request.folderId, request.remove);
        }
        if (request.action === 'stash')
            return Stash.stashWindow(request.windowId, request.name, request.remove);
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
        return Chrome.update(nameMap);
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
        return;
    },

    async stashInit() {
        /** @type {[boolean, NodeId, string]} */
        const settings = await Storage.getDict(['enable_stash', 'stash_home_root', 'stash_home_folder']);
        return Stash.init(settings);
    },

    help: () => Action.openHelp(),

    warn: Chrome.showWarningBadge,

}

/**
 * Filter out objects that have the given unique ids.
 * More efficient than `ids = new Set(ids); objects.filter(o => !ids.has(o.id));`
 * @template Thing
 * @param {Thing[]} objects
 * @param {any[] | Set<any>} ids
 * @returns {Thing[]}
 */
function excludeByIds(objects, ids) {
    if (!ids.length)
        return objects;
    ids = new Set(ids);
    const remainders = [];
    for (let i = 0, n = objects.length; i < n; i++) {
        if (ids.size) {
            const object = objects[i];
            if (!ids.delete(object.id))
                remainders.push(object);
        } else {
            remainders.push(...objects.slice(i));
            break;
        }
    }
    return remainders;
}

/**
 * @param {Object} request
 * @param {string} request.type
 * @returns {Promise<any>}
 */
function onExternalMessage(request) {
    /** @type {Function?} */
    const processor = EXTERNAL[request.type];
    return processor ?
        processor(request) :
        Promise.reject(new Error('Missing or unrecognized `type`'));
}

/**
 * @namespace EXTERNAL
 * @listens browser.runtime.onMessageExternal
 * @type {Object<string, Function>}
 */
const EXTERNAL = {

    /**
     * Return winfos with the specified `properties`.
     * If `windowIds` given, return only the winfos for them.
     * @param {Object} request
     * @param {string[]} request.properties
     * @returns {Promise<Object[] | Error>}
     * @param {WindowId[]} [request.windowIds]
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
