import { winfoMap } from './window.js';
import { DEFAULT_HEAD } from './name.js';

// [bgColor, textColor]
const unnamedWindowColors = ['black', 'white'];
const namedWindowColors   = ['white', 'black'];

export function update(windowId) {
    const winfo = winfoMap[windowId];
    const name = winfo.givenName;
    const [bgColor, textColor, text] = name && [...namedWindowColors, name] || [...unnamedWindowColors, defaultText(winfo)];
    browser.browserAction.setBadgeBackgroundColor({ windowId, color: bgColor });
    browser.browserAction.setBadgeTextColor({ windowId, color: textColor });
    browser.browserAction.setBadgeText({ windowId, text });
}

const defaultTextIndex = DEFAULT_HEAD.length;
const defaultText = winfo => '#' + winfo.defaultName.slice(defaultTextIndex);
