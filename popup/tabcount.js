import { sum } from '../utils.js';
import { $allWindowRows } from './popup.js';
import * as Status from './status.js';

export async function populate() {
    Status.show(' ');
    const tabCounts = await Promise.all($allWindowRows.map(getAndShow));
    Status.count.tabs = sum(tabCounts);
    Status.count.windows = $allWindowRows.length;
    Status.update();

    browser.tabs.onCreated.addListener(tabObject => increment(tabObject.windowId, 1));
    browser.tabs.onRemoved.addListener((_, info) => increment(info.windowId, -1));
    browser.tabs.onAttached.addListener((_, info) => increment(info.newWindowId, 1));
    browser.tabs.onDetached.addListener((_, info) => increment(info.oldWindowId, -1));
}

async function getAndShow($row) {
    const tabCount = (await browser.tabs.query({ windowId: $row._id })).length; // get
    $row.$tabCount.textContent = tabCount; // show
    return tabCount;
}

function increment(windowId, value) {
    const $row = $allWindowRows.find($row => $row._id == windowId);
    const $tabCount = $row.$tabCount;
    $tabCount.textContent = parseInt($tabCount.textContent) + value;
    Status.count.tabs += value;
    Status.update();
}
