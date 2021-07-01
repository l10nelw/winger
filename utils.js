export const getShortcut = async () => (await browser.commands.getAll())[0].shortcut;

// Forgiving* shorthands for element class methods. (*Silently does nothing if $el is undefined)
export const hasClass = (cls, $el) => $el?.classList.contains(cls);
export const addClass = (cls, $el) => $el?.classList.add(cls);
export const removeClass = (cls, $el) => $el?.classList.remove(cls);
export const toggleClass = (cls, $el, force) => $el?.classList.toggle(cls, force);

// Map with each key (group id) mapping to an array of items (group members).
export class GroupMap extends Map {
    group(item, key) {
        this.has(key) ? this.get(key).push(item) : this.set(key, [item]);
    }
}