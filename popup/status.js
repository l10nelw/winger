import { isOS } from '../utils.js';
import { $status } from './common.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const count = {
    windows: 1,
    tabs: 1,
    selectedTabs: 1,
};

const statusType = {
    stashShift: {
        condition: ({ key, type }) => type === 'keydown' && Omnibox.matchedCommand === 'stash' && key === 'Shift',
        content: `<kbd>Shift</kbd>: Stash without closing window`,
    },
    edit: {
        condition: () => EditMode.isActive,
        content: `Edit mode: <kbd>Enter</kbd> on a name when done`,
    },
    bring: {
        condition: ({ key, type }) => type === 'keydown' && key === 'Shift',
        content: `<kbd>Shift</kbd>: Bring tab to...`,
    },
    send: {
        condition: ({ key, type }) => type === 'keydown' && key === 'Control',
        content: `<kbd>Ctrl</kbd>: Send tab to...`,
    },
    oneWindow: {
        condition: () => count.windows === 1,
        content: `1 window - Press <kbd>${isOS('Mac OS') ? 'Cmd' : 'Ctrl'}</kbd>+<kbd>N</kbd> to add more!`,
    },
    default: {
        condition: () => true,
        content: () => `${count.windows} windows / ${count.tabs} ${count.tabs === 1 ? 'tab' : 'tabs'}`,
    },
}

//@ ([Object], Number), state -> state
export async function init($rows, selectedTabCount, stashEnabled) {
    count.selectedTabs = selectedTabCount;
    if (!stashEnabled)
        delete statusType.stashShift;

    const tabCounts = await Promise.all($rows.map(getAndShow));
    const sum = (a, b) => a + b; //@ (Number, Number) -> (Number)
    count.tabs = tabCounts.reduce(sum);
    count.windows = $rows.length;
    update();

    //! (Object), state -> (Number), state
    async function getAndShow($row) {
        const tabCount = (await browser.tabs.query({ windowId: $row._id })).length; // get
        $row.$tabCount.textContent = tabCount; // show
        return tabCount;
    }
}

//@ (Object) -> (String), state
export function update(event = {}) {
    for (const type in statusType) {
        const status = statusType[type];
        if (status.condition(event)) {
            if (typeof status.content === 'function')
                status.content = status.content();
            $status.innerHTML = status.content;
            return type;
        }
    }
}
