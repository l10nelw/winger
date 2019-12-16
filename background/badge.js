import { OPTIONS } from './options.js';
import * as Metadata from './metadata.js';

let show;

export function init() {
    show = OPTIONS.show_badge;
    if (show) {
        browser.browserAction.setBadgeTextColor({ color: 'black' });
        browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    }
}

export function update(windowId) {
    if (!show) return;
    const metaWindow = Metadata.windows[windowId];
    const text = `${metaWindow.displayName}`;
    browser.browserAction.setBadgeText({ windowId, text });
}
