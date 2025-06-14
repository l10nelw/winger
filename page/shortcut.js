// Get and format keyboard shortcut strings for use in documentation.

/**
 * @typedef {Object} ShortcutInfo
 * @property {string} description
 * @property {string} shortcut
 * @property {string} [defaultShortcut] - Included if shortcut is different from the manifest definition
 */

/**
 * @returns {Promise<Object<string, ShortcutInfo>>}
 */
export async function getDict() {
    const manifest = browser.runtime.getManifest().commands;
    const dict = {};
    for (const { name, description, shortcut } of await browser.commands.getAll()) {
        const defaultShortcut = manifest[name].suggested_key.default;
        dict[name] = (shortcut !== defaultShortcut) ?
            { description, shortcut, defaultShortcut } :
            { description, shortcut };
    }
    return dict;
}

/**
 * Wrap each key of shortcut in <kbd> tags.
 * @param {string} shortcut
 * @returns {string}
 */
export const format = shortcut => shortcut.split('+').map(key => `<kbd>${key}</kbd>`).join('+');
