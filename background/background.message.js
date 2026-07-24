import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as Winfo from './winfo.js';
import completeUpdate from './update.js';

import * as Storage from '../storage.js';
import * as Name from '../name.js';

/** @import { WindowId, BNode, WInfo, PopupInitMessage, ActionRequest, StashFolder, ChromeComponentName, ExtensionId, UpdateSource } from '../types.js' */

browser.runtime.onMessage.addListener(request => onMessage(INTERNAL, request));
browser.runtime.onMessageExternal.addListener((request, sender) => onMessage(EXTERNAL, request, sender));

/**
 * @listens browser.runtime.onMessage
 * @listens browser.runtime.onMessageExternal
 * @param {Object<string, Function>} fnCollection
 * @param {Object} request
 * @param {Object} [sender]
 * @returns {Promise<any>}
 */
function onMessage(fnCollection, request, sender) {
    /** @type {Function?} */
    const fn = fnCollection[request.type];
    return fn ? fn(request, sender) :
        new Error(`Missing or unrecognised message/request type: ${request.type}`);
}

/**
 * @listens browser.runtime.onMessage
 * @type {Object<string, Function>}
 */
const INTERNAL = {

    /**
     * @see /popup/request.js#debug
     */
    async debug() {
        const modules = {
            Action,
            Auto,
            Chrome,
            Menu: await import('./menu.js'),
            Name,
            Stash,
            StashCore: await import('./stash.core.js'),
            Storage,
            Winfo,
        };
        console.log(`Debug mode on - Exposing: ${Object.keys(modules).join(', ')}`);
        Object.assign(globalThis, modules);
    },

    /**
     * @returns {Promise<PopupInitMessage>}
     * @see /popup/request.js#popup
     */
    async popup() {
        /** @type {[Window[], PopupInitMessage['config']]} */
        let [windows, config] = await Promise.all([
            browser.windows.getAll({ populate: true }),
            Storage.getPopupConfig(),
        ]);
        windows = Stash.Main?.nowStashing.excludeFrom(windows) ?? windows; // Exclude windows currently being stashed
        const winfoProps = [
            'focused',
            'givenName',
            'incognito',
            'lastFocused',
            'minimized',
            'tabCount',
            'type',
            config.set_title_preface ? 'titleSansName' : 'title',
        ];
        const winfos = await Winfo.getAll(winfoProps, windows);
        return { ...Winfo.arrange(winfos), config };
    },

    /**
     * @returns {Promise<StashFolder[]>}
     * @see /popup/request.js#popupStashItems
     */
    async popupStashItems() {
        // Can assume Stash module loaded
        let folders = await (new Stash.Main.FolderList()).populate(await Stash.Main.homeId);
        folders = Stash.Main.nowUnstashing.excludeFrom(folders); // Exclude folders currently being unstashed
        return folders;
    },

    /**
     * @param {Object} request
     * @param {BNode[]} request.folders
     * @returns {Promise<StashFolder[]>}
     * @see /popup/request.js#popupStashSizes
     */
    async popupStashSizes({ folders }) {
        // Can assume Stash module loaded
        const folderList = await (new Stash.Main.FolderList()).populate(folders);
        return folderList.countBookmarks();
    },

    /**
     * @param {ActionRequest} request
     * @see /popup/request.js#action
     */
    action(request) {
        if (request.folderId) {
            // Can assume Stash module loaded
            if (request.action === 'send')
                return Stash.Main.stashSelectedTabs(request.folderId, request.remove);
            if (request.action === 'stash')
                return Stash.Main.unstashNode(request.folderId, request.remove);
        }
        if (request.action === 'stash')
            // Can assume Stash module loaded
            return Stash.Main.stashWindow(request.windowId, request.name, request.remove);
        return Action.execute(request);
    },

    /**
     * @param {Object} request
     * @param {UpdateSource} [request.source='system']
     * @param {string} [request.name]
     * @param {WindowId} [request.windowId]
     * @see /page/options.js#onFieldChanged
     * @see /popup/request.js#updateByUser
     */
    async update({ source = 'system', name, windowId }) {
        Auto.switchList.reset();
        // Explicity update a single window
        if (windowId && name)
            return completeUpdate([[windowId, name]], source);
        // Update all windows
        const winfos = await Winfo.getAll(['givenName']);
        const nameMap = (new Name.NameMap()).populate(winfos);
        completeUpdate(nameMap, source);
    },

    /**
     * @param {Object} request
     * @param {ChromeComponentName} request.component
     * @see /page/options.js#onFieldChanged
     */
    clear: ({ component }) => Chrome.clear(component),

    /**
     * @param {Object} request
     * @param {boolean} request.enabled
     * @see /page/options.js#onFieldChanged
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

    /**
     * @see /page/options.js#onFieldChanged
     */
    async stashInit() {
        const settings = await Storage.getDict(['enable_stash', 'stash_home_root_id', 'stash_home_folder_title']);
        await Stash.init(settings);
        Stash.Menu.init();
    },

    /**
     * @param {Object} request
     * @param {string} [request.hash]
     * @see /page/options.js#onFormClicked
     * @see /popup/request.js#help
     */
    help: ({ hash }) => Action.openHelp(hash),

    /**
     * @see /popup/request.js#showWarningBadge
     */
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
     * @returns {Promise<WInfo[] | Error>}
     */
    async info(request) {
        const { properties } = request;
        if (!Array.isArray(properties))
            throw new Error('`properties` array is required');

        const { windowIds } = request;
        if (windowIds && !windowIds.every?.(Number.isInteger))
            throw new Error('`windowIds` must be an array of integers');

        const bareWinfos = windowIds?.map(id => ({ id }));
        return Winfo.getAll(properties, bareWinfos);
    },

    /**
     * @param {Object} request
     * @param {string[]} request.properties
     * @param {Object} sender
     * @param {ExtensionId} sender.id
     */
    async subscribe({ properties }, sender) {
        if (!Array.isArray(properties))
            throw new Error('`properties` array is required');

        const extensionId = sender.id;
        const _subscriptions = await Storage.getValue('_subscriptions');
        properties = [...new Set(properties)];

        // Currently we only support 'name' property
        if (properties.find(prop => prop !== 'name'))
            throw new Error(`Unsupported property: ${prop}`);

        if (properties.length)
            _subscriptions[extensionId] = properties;
        else
            delete _subscriptions[extensionId]; // Empty array means unsubscribe; remove from SubscriptionDict

        Storage.set({ _subscriptions });
        return true;
    },

}
