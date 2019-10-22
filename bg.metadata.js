'use strict';

/*
Apart from these declared properties and methods, the Metadata object will also contain
properties representing windows, in the form of windowId (key): data object (value).
*/

var Metadata = {

    focusedWindowId: 0,

    lastWindowNumber: 0,

    sortLastFocused: true,

    async add(windowObject) {
        const windowId = windowObject.id;
        const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;
        this[windowId] = {
            tabCount,
            lastFocused: Date.now(),
            givenName: ``,
            defaultName: `Window ${++this.lastWindowNumber} / id ${windowId}`,
            textColor: '#fff',
            backColor: '#00f',
            id: windowId,
        };
    },

    remove(windowId) {
        delete this[windowId];
    },

    async init(callbacks) {
        const allWindows = await browser.windows.getAll({ populate: true });
        for (const windowObject of allWindows) {
            await this.add(windowObject);
            const windowId = windowObject.id;
            for (const callback of callbacks) {
                callback(windowId);
            }
        }
    },

    items() {
        let allData = [];
        for (const prop in this) {
            if (isNaN(prop)) continue;
            allData.push(this[prop]);
        }
        if (this.sortLastFocused) {
            allData.sort((a, b) => b.lastFocused - a.lastFocused);
        }
        return allData;
    },

    getName(windowId) {
        const data = this[windowId];
        return data.givenName || data.defaultName;
    },

    setName(windowId, name) {
        this[windowId].givenName = name;
    },

}