// Chrome refers to standard UI elements of the browser that frame the content.

import { getShortcut } from '../utils.js';


let Titlebar = {
    //@ (Number, String) -> state
    update(windowId, titlePreface) {
        browser.windows.update(windowId, { titlePreface });
    },
};

let ButtonTitle = {
    //@ state -> state
    async init() {
        this.base = `${browser.runtime.getManifest().name} (${await getShortcut()})`;
    },
    //@ (Number, String), state -> state
    update(windowId, titlePreface) {
        browser.browserAction.setTitle({ windowId, title: titlePreface + this.base });
    },
};

let ButtonBadge = {
    //@ -> state
    init() {
        browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    },
    //@ (Number, String) -> state
    update(windowId, name) {
        browser.browserAction.setBadgeText({ windowId, text: name });
    },
};

//@ (Object) -> state
export function init(SETTINGS) {
    ButtonTitle.init();

    if (SETTINGS.show_badge) {
        ButtonBadge.init();
    } else {
        ButtonBadge = null;
    }
}

//@ (Number, String) -> state
export function update(windowId, name) {
    const titlePreface = `${name} - `;
    Titlebar.update(windowId, titlePreface);
    ButtonTitle.update(windowId, titlePreface);
    ButtonBadge?.update(windowId, name);
}
