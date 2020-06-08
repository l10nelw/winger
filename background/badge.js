import { SETTINGS } from './settings.js';
import { defaultNameHead, windowMap } from './metadata.js';

// [bgColor, textColor]
const unnamedWindowColors = ['black', 'white'];
const namedWindowColors   = ['white', 'black'];

export function update(windowId) {
    if (!SETTINGS.show_badge) return;
    const metaWindow = windowMap[windowId];
    const name = metaWindow.givenName;
    const [bgColor, textColor, text] = name && [...namedWindowColors, name] || [...unnamedWindowColors, defaultText(metaWindow)];
    browser.browserAction.setBadgeBackgroundColor({ windowId, color: bgColor });
    browser.browserAction.setBadgeTextColor({ windowId, color: textColor });
    browser.browserAction.setBadgeText({ windowId, text });
}

const defaultTextIndex = defaultNameHead.length;
const defaultText = metaWindow => '#' + metaWindow.defaultName.slice(defaultTextIndex);
