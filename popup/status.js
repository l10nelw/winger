import { isOS } from '../utils.js';
import { BRING, SEND } from '../modifier.js';

const $status = document.getElementById('status');
const count = { tabs: 0, windows: 0 };
let defaultContent;

// Hint is shown if key matches; cleared by events handled in popup.js
export const modifierHint = {
    //@ (Number) -> state
    init(selectedTabCount) {
        const tabWord = selectedTabCount === 1 ? 'tab' : 'tabs';
        this[BRING] = `<kbd>${BRING}</kbd>: Bring ${tabWord} to...`;
        this[SEND] = `<kbd>${SEND}</kbd>: Send ${tabWord} to...`;
    },
    //@ (String) -> (String), state | (undefined)
    match(key) {
        if (key === 'Control')
            key = 'Ctrl';
        const hint = this[key];
        if (hint)
            show(hint);
        return hint;
    },
}

//@ ([Object]) -> state
export async function init($rows, selectedTabCount) {
    modifierHint.init(selectedTabCount);

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

// Show content in status bar. If none given, show last updated defaultContent.
//@ (String) -> state
export function show(content) {
    defaultContent ||= totalsContent();
    $status.innerHTML = content || defaultContent;
}

// Update and show defaultContent in status bar.
//@ state -> state
export function update() {
    $status.innerHTML =
        defaultContent =
        totalsContent();
}

//@ state -> (String)
function totalsContent() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1tab = tabs == 1;
    const is1window = windows == 1;
    return is1window ?
        `1 window - Press <kbd>${isOS('Mac OS') ? 'Cmd' : 'Ctrl'}</kbd>+<kbd>N</kbd> to add more!` :
        `${windows} windows / ${tabs} ${is1tab ? 'tab' : 'tabs'}`;
}
