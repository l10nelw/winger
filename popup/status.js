import { sum, addClass, toggleClass } from '../utils.js';

const $status = document.getElementById('status');
const count = { tabs: 0, windows: 0 };
let defaultText;

export async function init($allWindowRows) {
    const tabCounts = await Promise.all($allWindowRows.map(getAndShow));
    count.tabs = tabCounts.reduce(sum);
    count.windows = $allWindowRows.length;
    update();

    async function getAndShow($row) {
        const tabCount = (await browser.tabs.query({ windowId: $row._id })).length; // get
        $row.$tabCount.textContent = tabCount; // show
        return tabCount;
    }
}

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
    return `${tabs} ${is1tab ? 'tab' : 'tabs'} ${windows} ${is1window ? 'window' : 'windows'}`;
}
