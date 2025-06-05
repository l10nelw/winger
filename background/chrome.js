// The 'chrome' refers to UI components of the browser that frame the content.

import * as Storage from '../storage.js';
import * as Badge from './chrome.badge.js';

const TitlePreface = {

    //@ (Map(Number:String) | [[Number, String]]), state -> state
    async set(nameMap) {
        if (!await Storage.getValue('set_title_preface'))
            return;
        const [prefix, postfix] = await Storage.getValue(['title_preface_prefix', 'title_preface_postfix']);
        for (const [windowId, name] of nameMap) {
            const titlePreface = name ?
                (prefix + name + postfix) : '';
            browser.windows.update(windowId, { titlePreface });
        }
    },

    //@ -> state
    async clear() {
        const info = { titlePreface: '' };
        for (const { id } of await browser.windows.getAll())
            browser.windows.update(id, info);
    },
}

//@ -> state
export async function showWarningBadge() {
    clear('Badge');
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });
    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setTitle({ title: await getBaseButtonTitle() });
}

//@ (Map(Number:String) | [[Number, String]]), state -> state
export async function update(nameMap) {
    const [baseButtonTitle, show_badge] = await Promise.all([ getBaseButtonTitle(), Storage.getValue('show_badge') ]);
    // Button tooltip
    for (const [windowId, name] of nameMap) {
        const title = name ?
            `${name} - ${baseButtonTitle}` : baseButtonTitle;
        browser.browserAction.setTitle({ windowId, title });
    }
    // Button badge
    show_badge
        ? Badge.update(nameMap)
        : browser.browserAction.setBadgeText({ text: '' });
    // Title preface
    TitlePreface.set(nameMap);
}

/**
 * @param {'Badge' | 'TitlePreface'} component
 */
export function clear(component) {
    ({ Badge, TitlePreface })[component]?.clear();
}

//@ state -> String
const getBaseButtonTitle = async () => `${browser.runtime.getManifest().name} (${(await browser.commands.getAll())[0].shortcut})`;
