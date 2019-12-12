import * as Metadata from './metadata.js';

export function update(windowId) {
    const metaWindow = Metadata.windows[windowId];
    browser.browserAction.setBadgeText({ windowId, text: `${metaWindow.tabCount}` });
    browser.browserAction.setBadgeTextColor({ windowId, color: 'black' });
    browser.browserAction.setBadgeBackgroundColor({ windowId, color: 'white' });
}
