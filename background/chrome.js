// The 'chrome' refers to standard UI elements of the browser that frame the content.

import { getShortcut } from '../utils.js';

const Titlebar = {
    //@ (Number, String) -> state
    update(windowId, titlePreface) {
        browser.windows.update(windowId, { titlePreface });
    },
};

const ButtonTitle = {
    base: `${browser.runtime.getManifest().name} (${await getShortcut()})`,

    //@ (Number, String), state -> state
    update(windowId, titlePreface) {
        browser.browserAction.setTitle({ windowId, title: titlePreface + this.base });
    },
};

const ButtonBadge = {
    //@ -> state
    init() {
        browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    },
    //@ (Number, String) -> state
    update(windowId, name) {
        browser.browserAction.setBadgeText({ windowId, text: name });
    },
};

//@ (Number, String) -> state
export function update(windowId, name) {
    const titlePreface = name ? `${name} - ` : '';
    Titlebar.update(windowId, titlePreface);
    ButtonTitle.update(windowId, titlePreface);
    ButtonBadge.update(windowId, name);
}

ButtonBadge.init();
