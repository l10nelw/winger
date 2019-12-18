import { OPTIONS } from './options.js';
import { windows as metaWindows } from './metadata.js';

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
    const text = `${metaWindows[windowId].displayName}`;
    browser.browserAction.setBadgeText({ windowId, text });
}
