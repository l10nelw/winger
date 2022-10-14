import { BRING } from '../modifier.js';
import { canUnstash, unstash } from './stash.js';

const id = 'unstash';

// Add menu item
browser.menus.create({
    id,
    contexts: ['bookmark'],
    title: '&Unstash',
    enabled: false, // Disabled state as baseline
});

// Event handler: Check if target is unstash-able when menu shown; enable menu item if so.
//@ (Object) -> (Boolean), state|nil
export async function handleShow(info) {
    const nodeId = info.bookmarkId;
    if (nodeId) {
        if (await canUnstash(nodeId)) {
            browser.menus.update(id, { enabled: true });
            browser.menus.refresh();
        }
        return true; // Is handled as long as target is bookmark
    }
}

// Event handler: Re-disable menu item when menu disappears.
//@ -> state
export function handleHide() {
    browser.menus.update(id, { enabled: false });
}

// Event handler: Unstash target on click.
//@ (Object) -> (Boolean), state|nil
export function handleClick(info) {
    const nodeId = info.bookmarkId;
    if (nodeId) {
        unstash(nodeId, !info.modifiers.includes(BRING));
        return true;
    }
}
