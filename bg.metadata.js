'use strict';

var Metadata = {

    focusedWindowId: null,

    lastWindowNumber: 0,

    windows: {},

    async add(windowObject) {
        const windowId = windowObject.id;
        const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;
        const number = ++this.lastWindowNumber;
        this.windows[windowId] = {
            id: windowId,
            tabCount,
            number,
            lastFocused: Date.now(),
            defaultName: `Window ${number} / id ${windowId}`,
            givenName: ``,
            textColor: '#fff',
            backColor: '#00f',
        };
    },

    remove(windowId) {
        delete this.windows[windowId];
    },

    async init(callbacks) {
        const allWindows = await browser.windows.getAll({ populate: true });
        for (const windowObject of allWindows) {
            await this.add(windowObject);
            const windowId = windowObject.id;
            if (windowObject.focused) this.focusedWindowId = windowId;
            for (const callback of callbacks) callback(windowId);
        }
    },

    getName(windowId) {
        const data = this.windows[windowId];
        return data.givenName || data.defaultName;
    },

    setName(windowId, name) {
        this.windows[windowId].givenName = name;
    },

    sortBy: '',
    sortedIds: null,

    _sortMethod: {
        lastFocused: (a, b) => b.lastFocused - a.lastFocused,
        alphabetical: (a, b) => this.getName(a) - this.getName(b),
        age: (a, b) => a.number - b.number,
        lastFocusedReversed: (a, b) => a.lastFocused - b.lastFocused,
        alphabeticalReversed: (a, b) => this.getName(b) - this.getName(a),
        ageReversed: (a, b) => b.number - a.number,
    },

    sort(sortBy) {
        let windowObjects = Object.values(this.windows);
        windowObjects.sort(this._sortMethod[sortBy]);
        this.sortedIds = windowObjects.map(object => object.id);
        this.sortBy = sortBy;
        return this.sortedIds;
    },

}