import { testStashNode, unstash } from './stash.js';

export async function handleShow(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false;
    if (await testStashNode(nodeId)) {
        // Enable bookmark menu item only for valid node
        browser.menus.update('bookmark', { enabled: true });
        browser.menus.refresh();
    }
    return true;
}

export function handleHide() {
    browser.menus.update('bookmark', { enabled: false }); // Restore bookmark menu item's disabled status
}

export function handleClick(info) {
    const nodeId = info.bookmarkId;
    if (!nodeId) return false;
    unstash(nodeId);
    return true;
}
