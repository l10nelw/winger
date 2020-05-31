import { SETTINGS } from './settings.js';
import { windows as metaWindows } from './metadata.js';

export function init() {
    if (!SETTINGS.show_badge) return;
    browser.browserAction.setBadgeTextColor({ color: 'black' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
}

export function update(windowId) {
    const text = `${metaWindows[windowId].displayName}`;
    if (!SETTINGS.show_badge) return;
    browser.browserAction.setBadgeText({ windowId, text });
}
export { update as create };
