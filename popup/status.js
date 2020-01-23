import { count } from './count.js';

const $status = document.getElementById('status');
let defaultText;

$status.textContent = ' ';

// Show text in status bar. If no text given, show last updated defaultText.
export function show(text) {
    defaultText = defaultText || tabCountText();
    $status.textContent = text || defaultText;
    $status.classList.toggle('defaultStatus', !text);
}

// Update and show defaultText in status bar.
export function update() {
    $status.textContent = defaultText = tabCountText();
    $status.classList.add('defaultStatus');
}

function tabCountText() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1tab = tabs == 1;
    const is1window = windows == 1;
    return `${tabs} ${is1tab ? 'tab' : 'tabs'} ${is1window ? 'in' : 'across'} ${windows} ${is1window ? 'window' : 'windows'}`;
}
