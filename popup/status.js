import { count } from './count.js';
import { addClass, toggleClass } from '../utils.js';

const $status = document.getElementById('status');
let defaultText;

// Show text in status bar. If no text given, show last updated defaultText.
export function show(text) {
    defaultText = defaultText || tabCountText();
    $status.textContent = text || defaultText;
    toggleClass('defaultStatus', $status, !text);
}

// Update and show defaultText in status bar.
export function update() {
    $status.textContent = defaultText = tabCountText();
    addClass('defaultStatus', $status);
}

function tabCountText() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1tab = tabs == 1;
    const is1window = windows == 1;
    return `${tabs} ${is1tab ? 'tab' : 'tabs'} ${is1window ? 'in' : 'across'} ${windows} ${is1window ? 'window' : 'windows'}`;
}
