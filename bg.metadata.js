'use strict';

var Metadata = {

    focusedWindowId: null,

    lastWindowNumber: 0,

    windows: {},

    async add(windowObject) {
        const windowId = windowObject.id;
        const tabCount = windowObject.tabs ? windowObject.tabs.length : (await browser.tabs.query({ windowId })).length;

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
            textColor: '#fff',
            backColor: '#00f',
            lastFocused: Date.now(),
        };
        this.sortedIds = null;
    },

    remove(windowId) {
        delete this.windows[windowId];
        this.sortedIds = null;
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
        const windowObject = this.windows[windowId];
        return windowObject.givenName || windowObject.defaultName;
    },

    // Validate and set givenName for target window. Blank clears givenName.
    // Returns 0 if successful, otherwise returns output of isInvalidName().
    setName(windowId, name = '') {
        name = name.trim();
        const invalid = name ? this.isInvalidName(windowId, name) : 0;
        if (!invalid) this.windows[windowId].givenName = name;
        return invalid;
    },

    // Validate name for target window. Valid if unique, or equals target's defaultName (because why not).
    // Uniqueness is checked against all existing given and default names.
    // Returns 0 if valid, otherwise returns -1 or id of conflicting window.
    isInvalidName(windowId, name) {
        if (name.startsWith('/')) return -1;
        for (const id in this.windows) {
            const windowObject = this.windows[id];
            const isNotTarget = id != windowId;
            const sameAsGiven = windowObject.givenName == name;
            const sameAsDefault = windowObject.defaultName == name;
            if (sameAsGiven || (sameAsDefault && isNotTarget)) {
                return windowObject.id;
            }
        }
        return 0;
    },

    sortedIds: null, // Sort cache. Nulled on every init and add/remove window
    sortBy: 'lastFocused',
    sortReverse: false,

    // Sort windows by sortMethod, cache and return sortedIds.
    // If cached sortedIds of same sortMethod is available, skip sort and return sortedIds.
    sort(sortBy = this.sortBy) {
        if (!this.sortedIds || sortBy != this.sortBy) {
            let windowObjects = Object.values(this.windows);
            windowObjects.sort(this._sortMethod[sortBy]);
            this.sortedIds = windowObjects.map(object => object.id);
            this.sortBy = sortBy;
        }
        return this.sortedIds;
    },

    _sortMethod: {
        lastFocused: (a, b) => b.lastFocused - a.lastFocused,
        alphabetical: (a, b) => this.getName(a) - this.getName(b),
        age: (a, b) => a.number - b.number,
    },

}