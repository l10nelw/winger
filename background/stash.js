/** @type {typeof import('./stash.main.js')} */ export let Main;
/** @type {typeof import('./stash.menu.js')} */ export let Menu;

/**
 * @returns {Promise<boolean>}
 */
export const hasPermission = async () => (await browser.permissions.getAll()).permissions.includes('bookmarks');

/**
 * @param {Object} settings
 * @param {boolean} settings.enable_stash
 */
export async function init(settings) {
    if (!settings.enable_stash || !await hasPermission())
        return;
    if (!Main) {
        [Main, Menu] = await Promise.all([
            import('./stash.main.js'),
            import('./stash.menu.js'),
        ]);
    }
    Main.init(settings);
}