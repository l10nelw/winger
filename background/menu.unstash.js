import { canUnstash, unstash } from './stash.js';

export async function handleShow(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false; // Not bookmark menu; not handled
    if (await canUnstash(nodeId)) {
        browser.menus.update('bookmark', { enabled: true });
        browser.menus.refresh();
    }
    return true;
}

export function handleHide() {
    browser.menus.update('bookmark', { enabled: false }); // Restore disabled status
}

export function handleClick(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false; // Not bookmark menu; not handled
    unstash(nodeId);
    return true;
}
