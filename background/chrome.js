// Chrome refers to standard UI elements of the browser that frame the content.

import { getShortcut } from '../utils.js';


let Titlebar = {
    update(windowId, titlePreface) {
        browser.windows.update(windowId, { titlePreface });
    },
};

let ButtonTitle = {
    async init() {
        this.base = `${browser.runtime.getManifest().name} (${await getShortcut()})`;
    },
    update(windowId, titlePreface) {
        browser.browserAction.setTitle({ windowId, title: titlePreface + this.base });
    },
};

let ButtonBadge = {
    init() {
        browser.browserAction.setBadgeBackgroundColor({ color: 'white' });
    },
    update(windowId, name) {
        browser.browserAction.setBadgeText({ windowId, text: name });
    },
};


export function init(SETTINGS) {
    ButtonTitle.init();

    if (SETTINGS.show_badge) {
        ButtonBadge.init();
    } else {
        ButtonBadge = null;
    }
}

export function update(windowId, name) {
    const titlePreface = `${name} - `;
    Titlebar.update(windowId, titlePreface);
    ButtonTitle.update(windowId, titlePreface);
    ButtonBadge?.update(windowId, name);
}
