import * as Metadata from './metadata.js';

browser.browserAction.setBadgeTextColor({ color: 'black' });
browser.browserAction.setBadgeBackgroundColor({ color: 'white' });

export function update(windowId) {
    const metaWindow = Metadata.windows[windowId];
    const text = `${metaWindow.displayName}`;
    browser.browserAction.setBadgeText({ windowId, text });
}
