// Get and format keyboard shortcut strings for use in documentation.

/**
 * @typedef ShortcutInfo
 * @property {string} description
 * @property {string} shortcut
 * @property {string} [defaultShortcut] - Included if shortcut is different from the manifest definition
 */

/**
 * @returns {Promise<Object<string, ShortcutInfo>>}
 */
export async function getDict() {
    /** @type {Object<string, Object>} */ const manifest = browser.runtime.getManifest().commands;
    /** @type {Object<string, string>[]} */ const commands = await browser.commands.getAll();
    /** @type {Object<string, ShortcutInfo>} */ const dict = {};
    for (const { name, description, shortcut } of commands) {
        /** @type {string} */ const defaultShortcut = manifest[name].suggested_key.default;
        dict[name] = (shortcut === defaultShortcut) ?
            { description, shortcut } :
            { description, shortcut, defaultShortcut };
    }
    return dict;
}

/**
 * Wrap each key of shortcut in `<kbd>` elements.
 * (Verbose implementation to avoid using `innerHTML`)
 * @param {string} shortcut - e.g. "Ctrl+Shift+T"
 * @returns {DocumentFragment}
 */
export function formatHTML(shortcut) {
    const $fragment = document.createDocumentFragment();
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