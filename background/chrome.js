// The 'chrome' refers to UI elements of the browser that frame the content.

import * as Storage from '../storage.js';
import { getShortcut } from '../utils.js';

//@ -> state
export async function showWarningBadge() {
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });
    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setTitle({ title: await getBaseButtonTitle() });
}

//@ (Map(Number:String) | [[Number, String]]), state -> state
export async function update(nameMap) {
    const [baseButtonTitle, [set_title_preface, show_badge]] = await Promise.all([
        getBaseButtonTitle(),
        Storage.getValue(['set_title_preface', 'show_badge']),
    ]);
    // Button tooltip
    for (const [windowId, name] of nameMap) {
        const title = name ?
            `${name} - ${baseButtonTitle}` : baseButtonTitle;
        browser.browserAction.setTitle({ windowId, title });
    }
    // Title preface
    if (set_title_preface) {
        const [prefix, postfix] = await Storage.getValue(['title_preface_prefix', 'title_preface_postfix']);
        for (const [windowId, name] of nameMap) {
            const titlePreface = name ?
                (prefix + name + postfix) : '';
            browser.windows.update(windowId, { titlePreface });
        }
    }
    // Button badge
    if (show_badge) {
        browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
        for (const [windowId, text] of nameMap)
            browser.browserAction.setBadgeText({ windowId, text });
    } else {
        browser.browserAction.setBadgeText({ text: '' });
    }
}

//@ state -> String
const getBaseButtonTitle = async () => `${browser.runtime.getManifest().name} (${await getShortcut()})`;

//@ -> state
export async function clearTitlePreface() {
    const info = { titlePreface: '' };
    for (const { id } of await browser.windows.getAll())
        browser.windows.update(id, info);
}
