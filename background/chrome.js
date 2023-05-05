// The 'chrome' refers to UI elements of the browser that frame the content.

import { getShortcut } from '../utils.js';

//@ (Object) -> state
export function init({ show_badge }) {
    if (!show_badge)
        updateBadge = () => {};
}

//@ -> state
export function showWarningBadge() {
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });
    browser.browserAction.setBadgeText({ text: '⚠️' });
}

//@ (Number, String) -> state
export function update(windowId, name) {
    const titlePreface = name ? `${name} - ` : '';
    updateTitlebar(windowId, titlePreface);
    updateButtonTitle(windowId, titlePreface);
    updateBadge(windowId, name);
}

//@ (Number, String) -> state
function updateBadge(windowId, text) {
    browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    browser.browserAction.setBadgeText({ windowId, text });
}

//@ (Number, String), state -> state
async function updateButtonTitle(windowId, titlePreface) {
    const title = `${titlePreface}${browser.runtime.getManifest().name} (${await getShortcut()})`;
    browser.browserAction.setTitle({ windowId, title });
}

//@ (Number, String) -> state
function updateTitlebar(windowId, titlePreface) {
    browser.windows.update(windowId, { titlePreface });
}
