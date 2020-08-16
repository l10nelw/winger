import { getName } from './metadata.js';

export function update(windowId) {
    const titlePreface = `${getName(windowId)} - `;
    updateTitlebar(windowId, titlePreface);
    updateIconTooltip(windowId, titlePreface);
}

function updateTitlebar(windowId, titlePreface) {
    browser.windows.update(windowId, { titlePreface });
}

async function updateIconTooltip(windowId, titlePreface) {
    const { name } = browser.runtime.getManifest();
    const [{ shortcut }] = await browser.commands.getAll();
    const title = `${titlePreface}${name} (${shortcut})`;
    browser.browserAction.setTitle({ windowId, title });
}