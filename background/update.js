import * as Storage from '../storage.js';
import * as Chrome from './chrome.js';

/** @import { ExtensionId, SubscriptionDict, UpdateSource, WindowIdNamePairs, WindowUpdatedMessage, WInfo } from '../types.js' */

/**
 * @param {WindowIdNamePairs} nameMap
 * @param {UpdateSource} source
 */
export default function completeUpdate(nameMap, source) {
    Chrome.update(nameMap);
    notifySubscribers(nameMap, source);
}

/**
 * Notify subscribing extensions of a window naming event (NOTE: only 'name' property is currently supported).
 * @param {WindowIdNamePairs} nameMap
 * @param {UpdateSource} source
 */
async function notifySubscribers(nameMap, source) {
    /** @type {Pick<WInfo, 'id'|'name'>[]} */
    const windows = [];
    for (const [windowId, name] of nameMap)
        windows.push({ id: windowId, name });

    /** @type {WindowUpdatedMessage} */
    const message = { type: 'updated', windows, source };

    /** @type {ExtensionId[]} */
    const subscriberIds = [];

    const subscriptionDict = await Storage.getValue('_subscriptions');
    for (const [subscriberId, properties] of /** @type {[ExtensionId, string[]][]} */ (Object.entries(subscriptionDict)))
        if (properties.includes('name'))
            subscriberIds.push(subscriberId);

    // Send message to listening extensions and collect their responses
    // Recipients should return `true` if they wish to continue receiving messages
    const responses = await Promise.all(subscriberIds.map(
        /**
         * @param {ExtensionId} subscriberId
         * @returns {Promise<boolean>}
         */
        subscriberId => browser.runtime.sendMessage(subscriberId, message).catch(() => false)
    ));
    if (responses.every(Boolean))
        return; // If all `true` no further steps needed

    // Remove ids of extensions that didn't return `true`
    /** @type {SubscriptionDict} */
    const _subscriptions = {};
    for (let i = 0, n = subscriberIds.length; i < n; i++) if (responses[i]) {
        const subscriberId = subscriberIds[i];
        _subscriptions[subscriberId] = subscriptionDict[subscriberId];
    }
    Storage.set({ _subscriptions });
}