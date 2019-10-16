'use strict';

/*
Apart from these declared properties and methods, the Metadata object will also contain
properties representing windows, in the form of windowId (key): data object (value).
*/

var Metadata = {

    focused: 0,

    lastWindowNumber: 0,
    
    async add(window) {
        const windowId = window.id;
        const tabCount = window.tabs ? window.tabs.length : (await browser.tabs.query({ windowId })).length;
        this[windowId] = {
            tabCount,
            lastFocused: Date.now(),
            givenName: ``,
            defaultName: `Window ${++this.lastWindowNumber} / id ${windowId}`,
            textColor: '#fff',
            backColor: '#00f',
        };
    },

    remove(windowId) {
        delete this[windowId];
    },

    async populate(callback) {
        const allWindows = await browser.windows.getAll({ populate: true });
        for (const window of allWindows) {
            await this.add(window);
            callback(window.id);
        }
    },

    items() {
        let allData = [];
        for (const prop in this) {
            if (isNaN(prop)) continue;
            let data = this[prop];
            data.id = prop;
            allData.push(data);
        }
        return allData;
    },

    getName(windowIdOrObject) {
        const data = (windowIdOrObject instanceof Object) ? windowIdOrObject : this[windowIdOrObject];
        return data.givenName || data.defaultName;
    },

    setName(windowId, name) {
        this[windowId].givenName = name;
    },

    async checkSanity() {
        const allWindows = await browser.windows.getAll({ populate: true });
        const allData = this.items();

        const windowCount = allWindows.length;
        const dataWindowCount = allData.length;

        console.log({ windowCount, dataWindowCount });
        
        if (windowCount !== dataWindowCount) {
            console.error(`Window count mismatch`);
            return;
        }

        const sortById = (a, b) => a.id - b.id;
        const tabCounts = allWindows.sort(sortById).map(window => window.tabs.length);
        const dataTabCounts = allData.sort(sortById).map(data => data.tabCount);
        
        const objZip = (a, b) => a.map((x, i) => ({ 'tabCount': x, 'dataTabCount': b[i] }));
        console.table(objZip(tabCounts, dataTabCounts));
        
        for (let i = windowCount; i--;) {
            if (tabCounts[i] !== dataTabCounts[i]) console.error(`Tab count mismatch at [${i}]`);
        }
    },

}