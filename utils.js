export const sum = (a, b) => a + b;

export const getScrollbarWidth = $el => $el.offsetWidth - $el.clientWidth;

export const getShortcut = async () => (await browser.commands.getAll())[0].shortcut;

// Forgiving* shorthands for element class methods. (*Silently does nothing if $el is undefined)
export const hasClass = (cls, $el) => $el?.classList.contains(cls);
export const addClass = (cls, $el) => $el?.classList.add(cls);
export const removeClass = (cls, $el) => $el?.classList.remove(cls);
export const toggleClass = (cls, $el, force) => $el?.classList.toggle(cls, force);

// Element type
export const isButton = $el => $el.tagName === 'BUTTON';
export const isInput = $el => $el.tagName === 'INPUT';

// Add item to groupMap according to groupId.
// The groupMap should be an existing object that maps a groupId to an array of member items.
export function addToGroup(item, groupId, groupMap) {
    if (groupId in groupMap) {
        groupMap[groupId].push(item);
    } else {
        groupMap[groupId] = [item];
    }
}