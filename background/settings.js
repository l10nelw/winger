const DEFAULT = {
    theme: 'system',

    keep_moved_focused_tab_focused: true,
    keep_moved_tabs_selected: true,

    show_badge: false,

    enable_tab_menu: true,
    enable_link_menu: true,

    enable_stash: false,
    stash_home: 'toolbar_____',
    stash_home_name: 'Stashed Windows',
};

const NEEDS_PERMISSION = {
    // Boolean setting: Permission required
    enable_stash: 'bookmarks',
};

export let SETTINGS;

// Save settings provided as key-value pairs.
//@ (Object) -> state
export function set(settings) {
    return browser.storage.local.set({ settings });
}

// Retrieve all settings.
//@ state -> state
export async function get() {
    // If not retrieved yet, try to get `settings` object, otherwise try to get v1 settings, otherwise get default
    // TODO: In a future update, don't try to get v1 settings anymore
    SETTINGS ??= (await browser.storage.local.get('settings'))?.settings || await browser.storage.local.get(DEFAULT);
    await checkPermissions(); // May make changes to SETTINGS
    return SETTINGS;
}

// Check retrieved settings enabling features that require permissions.
// If any expected permissions absent, disable associated settings and save changes.
// If any permissions unused, remove them.
//@ state -> null|state
async function checkPermissions() {
    const grantedPermissions = (await browser.permissions.getAll()).permissions;
    const unusedPermissions = [];
    const unpermittedSettings = [];
    for (const [setting, permission] of Object.entries(NEEDS_PERMISSION)) {
        const isEnabled = SETTINGS[setting];
        const isPermitted = grantedPermissions.includes(permission);
        if (isEnabled && !isPermitted)
            unpermittedSettings.push(setting);
        else
        if (!isEnabled && isPermitted)
            unusedPermissions.push(permission);
    }
    if (unpermittedSettings.length) {
        unpermittedSettings.forEach(setting => SETTINGS[setting] = false);
        set(SETTINGS);
    }
    if (unusedPermissions.length) {
        browser.permissions.remove({ permissions: unusedPermissions });
    }
}