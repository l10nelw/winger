import * as Metadata from './metadata.js';

export function update(windowId) {
    browser.windows.update(windowId, { titlePreface: windowTitle(windowId) });
}

function windowTitle(windowId) {
    return `${Metadata.windows[windowId].displayName} - `;
}
