// The 'chrome' refers to UI elements of the browser that frame the content.

import * as Settings from '../settings.js';
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

//@ (Map(Number:String)|[[Number, String]]), state -> state
export async function update(nameMap) {
    const [prefix, postfix] = await Settings.getValue(['title_preface_prefix', 'title_preface_postfix']);
    for (const [windowId, name] of nameMap) {
        const titlePreface = name ?
            (prefix + name + postfix) : '';
        updateTitlebar(windowId, titlePreface);
        updateButtonTitle(windowId, titlePreface);
        updateBadge(windowId, name);
    }
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
