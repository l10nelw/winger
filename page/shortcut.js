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

export const format = shortcut => shortcut.split('+').map(key => `<kbd>${key}</kbd>`).join('+');

/**
 * Wrap each key of shortcut in <kbd> tags.
 * Verbose implementation to avoid using `innerHTML`.
 * @param {string} shortcut
 * @returns {string}
 */
export function formatHTML(shortcut) {
    const $fragment = document.createDocumentFragment();
    /** @type {string[]} */
    const keys = shortcut.split('+');
    for (let i = 0, count = keys.length; i < count; i++) {
        const $kbd = document.createElement('kbd');
        $kbd.textContent = keys[i];
        $fragment.append($kbd);
        if (i < count - 1)
            $fragment.append('+');
    }
    return $fragment;
}