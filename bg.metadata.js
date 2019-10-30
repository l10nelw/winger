'use strict';

var Metadata = {

    focusedWindowId: null,

    lastWindowNumber: 0,

    windows: {},

    async add(windowObject) {
        const windowId = windowObject.id;
        const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;
        const now = Date.now();

        // Generate unique defaultName
        let number, defaultName;
        do {
            number = ++this.lastWindowNumber;
            defaultName = `Window ${number} / id ${windowId}`;
        } while (this.isInvalidName(windowId, defaultName));

        this.windows[windowId] = {
            id: windowId,
            tabCount,
            number,
            defaultName,
            givenName: '',
            displayName: defaultName,
            textColor: '#fff',
            backColor: '#00f',
            created: now,
            lastFocused: now,
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

    // Validate and assign givenName for target window. Blank clears givenName.
    // Automatically sets displayName.
    // Returns 0 if successful, otherwise returns output of isInvalidName().
    setName(windowId, name = '') {
        name = name.trim();
        const metaWindow = this.windows[windowId];
        const status = name ? this.isInvalidName(windowId, name) : 0;
        if (status == 0) {
            metaWindow.givenName = name;
            metaWindow.displayName = metaWindow.givenName || metaWindow.defaultName;
        }
        return status;
    },

    // Validate name for target window.
    // Valid if unique and has no disallowed characters, or equals target's defaultName (because why not).
    // Uniqueness is checked against all existing given and default names.
    // Returns 0 if valid, otherwise returns -1 or id of conflicting window.
    isInvalidName(windowId, name) {
        if (name.startsWith('/') || /['"]/.test(name)) {
            return -1;
        }
        for (const id in this.windows) {
            const metaWindow = this.windows[id];
            const isNotTarget = id != windowId;
            const sameAsGiven = metaWindow.givenName == name;
            const sameAsDefault = metaWindow.defaultName == name;
            if (sameAsGiven || (sameAsDefault && isNotTarget)) {
                return metaWindow.id;
            }
        }
        return 0;
    },

    // Sort windows by sortMethod, return windowIds.
    sortedIds(sortBy = 'lastFocused') {
        let metaWindows = Object.values(this.windows);
        metaWindows.sort(this._sortMethod[sortBy]);
        const windowIds = metaWindows.map(object => object.id);
        return windowIds;
    },

    _sortMethod: {
        age: (a, b) => a.created - b.created,
        lastFocused: (a, b) => b.lastFocused - a.lastFocused,
        alphabetical: (a, b) => {
            if (a.displayName > b.displayName) return 1;
            if (a.displayName < b.displayName) return -1;
            return 0;
        },
    },

}