import { SETTINGS } from './settings.js';
import { windowMap } from './metadata.js';

export function init() {
    if (!SETTINGS.show_badge) return;
    browser.browserAction.setBadgeTextColor({ color: 'black' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
}

export function update(windowId) {
    if (!SETTINGS.show_badge) return;
    const text = `${windowMap[windowId].displayName}`;
    browser.browserAction.setBadgeText({ windowId, text });
}
export { update as create };
