import { getName } from './metadata.js';

export function update(windowId) {
    browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
}
export { update as create };

const windowTitle = windowId => `${getName(windowId)} - `;