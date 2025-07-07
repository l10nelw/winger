/** @param {string} @returns {boolean} */ export const isOS = osName => navigator.userAgent.indexOf(osName) !== -1;

/** @param {any} @returns {boolean} */ export const isWindowId = Number.isInteger;
/** @param {any} @returns {boolean} */ export const isNodeId = id => typeof id === 'string';

/**
 * Provides a more manual inclusion of items compared to `Map.groupBy()`.
 */
export class GroupMap extends Map {
    /**
     * @param {any} key
     * @param {any} item
     * @modifies this
     */
    group(key, item) {
        this.has(key)
            ? this.get(key).push(item)
            : this.set(key, [item]);
    }
}
