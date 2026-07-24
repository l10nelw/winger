// The 'chrome' refers to UI components of the browser that frame the content.
// Relevant components: button tooltip, button badge, title preface

import * as Badge from './chrome.badge.js';
import * as Storage from '../storage.js';

/** @import { ChromeComponentName, WindowId } from '../types.js' */

const TitlePreface = {

    /**
     * @param {Map<WindowId, string> | [WindowId, string][]} nameMap
     */
    async set(nameMap) {
        const { title_preface_prefix, title_preface_postfix } = await Storage.getDict(['title_preface_prefix', 'title_preface_postfix']);
        for (const [windowId, name] of nameMap) {
            const titlePreface = name ?
                (title_preface_prefix + name + title_preface_postfix) : '';
            browser.windows.update(windowId, { titlePreface });
        }
    },

    async clear() {
        const info = { titlePreface: '' };
        for (const { id } of await browser.windows.getAll())
            browser.windows.update(id, info);
    },
}

export async function showWarningBadge() {
    clear('Badge');
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });
    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setTitle({ title: await getBaseButtonTitle() });
}

/**
 * @param {Map<WindowId, string> | [WindowId, string][]} nameMap
 */
export async function update(nameMap) {
    const [baseButtonTitle, { show_badge, set_title_preface }] = await Promise.all([
        getBaseButtonTitle(),
        Storage.getDict(['show_badge', 'set_title_preface']),
    ]);

    // Button tooltip
    for (const [windowId, name] of nameMap) {
        const title = name ?
            `${name} - ${baseButtonTitle}` : baseButtonTitle;
        browser.browserAction.setTitle({ windowId, title });
    }

    // Button badge
    show_badge
        ? Badge.update(nameMap)
        : Badge.clear();

    // Title preface
    if (set_title_preface)
        TitlePreface.set(nameMap);
}

/**
 * Remove all names for a given chrome component.
 * Used when disabling a component.
 * @param {ChromeComponentName} component
 */
export function clear(component) {
    ({ Badge, TitlePreface })[component]?.clear();
}

/**
 * Default: "Winger (F1)"
 * @returns {Promise<string>}
 */
const getBaseButtonTitle = async () => `${browser.runtime.getManifest().name} (${(await browser.commands.getAll())[0].shortcut})`;
