import { getName } from './metadata.js';
import { getShortcut } from '../utils.js';

export function update(windowId) {
    const titlePreface = `${getName(windowId)} - `;
    updateTitlebar(windowId, titlePreface);
    updateIconTooltip(windowId, titlePreface);
}

function updateTitlebar(windowId, titlePreface) {
    browser.windows.update(windowId, { titlePreface });
}

async function updateIconTooltip(windowId, titlePreface) {
    const title = `${titlePreface}${browser.runtime.getManifest().name} (${await getShortcut()})`;
    browser.browserAction.setTitle({ windowId, title });
}