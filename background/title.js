import { windowMap } from './metadata.js';

export function init() {}

export function update(windowId) {
    browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
}
export { update as create };

function windowTitle(windowId) {
    return `${windowMap[windowId].displayName} - `;
}
