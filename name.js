import { isWindowId } from './utils.js';

/** @typedef {import('./types.js').WindowId} WindowId */
/** @typedef {import('./types.js').BNodeId} FolderId */

const NUMBER_POSTFIX = / (\d+)$/;

/**
 * @param {WindowId} windowId
 * @returns {Promise<string>}
 */
export async function load(windowId) {
    return await browser.sessions.getWindowValue(windowId, 'givenName') || '';
}

/**
 * @param {WindowId} windowId
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export function save(windowId, name) {
    return browser.sessions.setWindowValue(windowId, 'givenName', name).then(() => true, () => false);
}

/**
 * Add " 2" at the end of name, or increment an existing number postfix.
 * @param {string} name
 * @returns {string}
 */
function addNumberPostfix(name) {
    const found = name.match(NUMBER_POSTFIX);
    return found ?
        `${name.slice(0, found.index)} ${+found[1] + 1}` : `${name} 2`;
}

/**
 * Remove spaces and illegal characters from name.
 * @param {string} name
 * @returns {string}
 */
export function validify(name) {
    name = name.trim();
    return startsWithSlash(name) ?
        validify(name.slice(1)) : name;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function startsWithSlash(name) {
    return name.startsWith('/');
}

/**
 * Map windowIds/folderIds to names, and provide methods that work in the context of all present names.
 */
export class NameMap extends Map {

    /**
     * @param {HTMLInputElement[] | Winfo[]} objects - Either an array of $names, or an array of winfos containing givenNames.
     * @returns {this & Map<(WindowId | FolderId), string>}
     */
    populate(objects) {
        if (objects[0] instanceof HTMLInputElement) {
            for (const { _id, value } of objects) // $names
                this.set(_id, value);
        } else {
            for (const { id, givenName } of objects) // winfos
                this.set(id, givenName);
        }
        return this;
    }

    /**
     * Has at least one open-window name (excludes stashed-windows).
     * Expects all stashed-windows to be at the end of the map.
     * @returns {boolean}
     */
    hasWindowName() {
        for (const [id, name] of this)
            if (!isWindowId(id)) // No more open-windows in loop
                return false;
            else if (name)
                return true;
    }

    /**
     * Find name in map. Ignores blank. Return associated id if found, else return 0.
     * @param {string} name
     * @returns {WindowId | FolderId | 0}
     */
    findId(name) {
        if (name)
            for (const [id, _name] of this)
                if (name === _name)
                    return id;
        return 0;
    }

    /**
     * Check name against map for errors, including duplication.
     * Return 0 if name is blank or valid-and-unique or conflicting id is excludeId. Else return -1 or conflicting id.
     * @param {string} name
     * @param {WindowId | FolderId} excludeId
     * @returns {0 | -1 | WindowId | FolderId}
     */
    checkForErrors(name, excludeId) {
        if (!name)
            return 0;
        if (startsWithSlash(name))
            return -1;
        const foundId = this.findId(name);
        return foundId === excludeId ?
            0 : foundId;
    }

    /**
     * Check valid name against map for duplication. Ignores blank. If name is not unique, add/increment number postfix. Return unique result.
     * @param {string} name
     * @returns {string}
     */
    uniquify(name) {
        return (name && this.findId(name)) ?
            this.uniquify(addNumberPostfix(name)) : name;
    }
}
