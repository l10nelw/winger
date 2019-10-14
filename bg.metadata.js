'use strict';

/*
Apart from these declared properties and methods, the Metadata object will also contain properties
representing windows, in the form of windowId (key): data object (value).
*/

var Metadata = {

    lastWindowNumber: 0,
    
    async add(window) {
        const windowId = window.id;
        const tabCount = window.tabs ? window.tabs.length : (await browser.tabs.query({ windowId })).length;
        this[windowId] = {
            tabCount,
            lastFocused: Date.now(),
            name: ``,
            defaultName: `Window ${++this.lastWindowNumber} / id ${windowId}`,
            textColor: '#fff',
            backColor: '#00f',
        };
    },

    remove(windowId) {
        delete this[windowId];
    },

    async populate(callback) {
        const allWindows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
        for (const window of allWindows) {
            await this.add(window);
            callback(window.id);
        }
    },

    items() {
        let windows = [];
        for (const prop in this) {
            if (isNaN(prop)) continue;
            let window = this[prop];
            window.id = prop;
            windows.push(window);
        }
        return windows;
    },

    async checkSanity() {
        const allWindows = await browser.windows.getAll({ populate: true, windowTypes: ['normal'] });
        const dataItems = this.items();

        const windowCount = allWindows.length;
        const dataWindowCount = dataItems.length;

        console.log({ windowCount, dataWindowCount });
        
        if (windowCount !== dataWindowCount) console.error(`Window count mismatch`);

        const sortById = (a, b) => a.id - b.id;
        const tabCounts = allWindows.sort(sortById).map(window => window.tabs.length);
        const dataTabCounts = dataItems.sort(sortById).map(data => data.tabCount);
        
        const objZip = (a, b) => a.map((x, i) => ({ tabCount: x, dataTabCount: b[i] }));
        console.table(objZip(tabCounts, dataTabCounts));
        
        for (let i = windowCount; i--;) {
            if (tabCounts[i] !== dataTabCounts[i]) console.error(`Tab count mismatch at [${i}]`);
        }
    },

}