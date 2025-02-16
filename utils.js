//@ (String), state -> (Boolean)
export const isOS = osName => navigator.userAgent.indexOf(osName) !== -1;

//@ (Any) -> (Boolean)
export const isWindowId = Number.isInteger;
export const isFolderId = id => typeof id === 'string';

// Map with each key (group id) mapping to an array of items (group members).
export class GroupMap extends Map {
    group(key, item) {
        this.has(key)
        ? this.get(key).push(item)
        : this.set(key, [item]);
    }
}