import { isOS } from '../utils.js';

const $status = document.getElementById('status');
const count = { tabs: 0, windows: 0 };
let defaultText;

//@ ([Object]) -> state
export async function init($rows) {
    const tabCounts = await Promise.all($rows.map(getAndShow));
    const sum = (a, b) => a + b; //@ (Number, Number) -> (Number)
    count.tabs = tabCounts.reduce(sum);
    count.windows = $rows.length;
    update();

    async function getAndShow($row) {
        const tabCount = (await browser.tabs.query({ windowId: $row._id })).length; // get
        $row.$tabCount.textContent = tabCount; // show
        return tabCount;
    }
}

// Show text in status bar. If no text given, show last updated defaultText.
//@ (String) -> state
export function show(text) {
    defaultText ||= tabCountText();
    $status.textContent = text || defaultText;
}

// Update and show defaultText in status bar.
//@ state -> state
export function update() {
    $status.textContent =
        defaultText =
        tabCountText();
}

//@ state -> (String)
function tabCountText() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1tab = tabs == 1;
    const is1window = windows == 1;
    return is1window ?
        `1 window - Press ${isOS('Mac OS') ? 'Cmd' : 'Ctrl'}+N to add more!` :
        `${windows} windows / ${tabs} ${is1tab ? 'tab' : 'tabs'}`;
}
