import { GroupMap } from '../utils.js';

/** @import { WindowId, TabId, GroupId, Tab, Group } from '../types.js' */

/**
 * Map of groupIds to arrays of their associated tabIds - `Map<GroupId, TabId[]>`
 */
export class GroupIdTabIdMap extends GroupMap {

    /**
     * Include tabIds in map for each tab that is part of a group.
     * @param {Tab[]} tabs
     */
    addTabsIfGroup(tabs) {
        for (const tab of tabs)
            if (tab.groupId !== -1)
                this.group(tab.groupId, tab.id);
    }

    /**
     * Purge groups that do not have all their tabs listed.
     */
    async deletePartialGroupEntries() {
        if (!this.size)
            return;
        /** @type {Tab[][]} */
        const allMembersOfGroups = await Promise.all( [...this.keys()].map(groupId => browser.tabs.query({ groupId })) );
        for (const allMembersOfGroup of allMembersOfGroups) {
            const { groupId } = allMembersOfGroup[0];
            if (allMembersOfGroup.length !== this.get(groupId).length)
                this.delete(groupId);
        }
    }

    /**
     * For each groupId key, get the group details.
     * @returns {Promise<Group[]>}
     */
    async getGroups() {
        return this.size ?
            Promise.all( [...this.keys()].map(groupId => browser.tabGroups.get(groupId)) ) : [];
    }

    /**
     * When map contains old group ids and new tab ids as entries,
     * this creates new groups in `windowId` using the tab ids and info provided in `oldGroups`.
     * @param {Group[]} oldGroups - Groups whose ids exist in the map as keys
     * @param {WindowId} windowId - Destination window's id
     * @returns {Promise<Group[]>}
     */
    async recreateGroups(oldGroups, windowId) {
        if (!oldGroups.length)
            return [];
        return Promise.all(oldGroups.map(
            /**
             * @param {Group} oldGroup
             * @returns {Group}
             */
            async ({ color, id, title }) => {
                /** @type {TabId[]} */ const tabIds = this.get(id);
                /** @type {GroupId} */ const newGroupId = await browser.tabs.group({ tabIds, createProperties: { windowId } });
                return browser.tabGroups.update(newGroupId, { color, title });
            }
        ));
    }

}
