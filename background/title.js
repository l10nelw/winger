import { getName } from './metadata.js';

export function update(windowId) {
    browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
}

const windowTitle = windowId => `${getName(windowId)} - `;