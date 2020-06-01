import { SETTINGS } from './settings.js';
import { getName } from './metadata.js';

export function init() {
    if (!SETTINGS.show_badge) return;
    browser.browserAction.setBadgeTextColor({ color: 'black' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
}

export function update(windowId) {
    if (!SETTINGS.show_badge) return;
    browser.browserAction.setBadgeText({ windowId, text: getName(windowId) });
}
export { update as create };
