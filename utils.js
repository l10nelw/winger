//@ state -> (String)
export const getShortcut = async () => (await browser.commands.getAll())[0].shortcut;

// Map with each key (group id) mapping to an array of items (group members).
export class GroupMap extends Map {
    group(item, key) {
        this.has(key) ? this.get(key).push(item) : this.set(key, [item]);
    }
}