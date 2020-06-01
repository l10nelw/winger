import { getName } from './metadata.js';

const windowTitle = windowId => `${getName(windowId)} - `;

export function init() {}

export function update(windowId) {
    browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
}
export { update as create };
