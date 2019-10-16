'use strict';

var BrowserOp = {

    modifierKey: {
        sendTabs: 'shiftKey',
        bringTabs: 'ctrlKey',
    },

    updateWindowBadge(windowId) {
        const data = Metadata[windowId];
        browser.browserAction.setBadgeText({ windowId, text: `${data.tabCount}` });
        browser.browserAction.setBadgeTextColor({ windowId, color: data.textColor });
        browser.browserAction.setBadgeBackgroundColor({ windowId, color: data.backColor });
    },

    focusWindow(windowId) {
        browser.windows.update(windowId, { focused: true });
    },

    async moveSelectedTabs(windowId, stayActive, staySelected) {
        const selectedTabs = await browser.tabs.query({ currentWindow: true, highlighted: true });
        const selectedTabIds = selectedTabs.map(tab => tab.id);
        await browser.tabs.move(selectedTabIds, { windowId, index: -1 });

        if (stayActive) {
            const activeTab = selectedTabs.find(tab => tab.active);
            browser.tabs.update(activeTab.id, { active: true });
        }
        if (staySelected) {
            for (const tabId of selectedTabIds) {
                browser.tabs.update(tabId, { highlighted: true, active: false });
            }
        }
    },

    async respond(event, windowId, otherSendTabCondition) {
        if (event[this.modifierKey.sendTabs] || otherSendTabCondition) {
            this.moveSelectedTabs(windowId);
        }
        else
        if (event[this.modifierKey.bringTabs]) {
            await this.moveSelectedTabs(windowId, true, true);
            this.focusWindow(windowId);
        }
        else
        {
            this.focusWindow(windowId);
        }
    },

}
