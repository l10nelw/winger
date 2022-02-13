import { canUnstash, unstash } from './stash.js';

//@ (Object) -> (Boolean), state|null
export async function handleShow(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false; // Not bookmark menu; not handled
    if (await canUnstash(nodeId)) {
        browser.menus.update('bookmark', { enabled: true });
        browser.menus.refresh();
    }
    return true;
}

//@ -> state
export function handleHide() {
    browser.menus.update('bookmark', { enabled: false }); // Restore disabled status
}

//@ (Object) -> (Boolean), state|null
export function handleClick(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false; // Not bookmark menu; not handled
    unstash(nodeId, !info.modifiers.includes('Shift'));
    return true;
}
