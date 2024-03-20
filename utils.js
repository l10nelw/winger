//@ state -> (String)
export const getShortcut = async () => (await browser.commands.getAll())[0].shortcut;

//@ (String), state -> (Boolean)
export const isOS = osName => navigator.userAgent.indexOf(osName) !== -1;

// Map with each key (group id) mapping to an array of items (group members).
export class GroupMap extends Map {
    group(key, item) {
        this.has(key)
        ? this.get(key).push(item)
        : this.set(key, [item]);
    }
}