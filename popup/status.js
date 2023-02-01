import { isOS } from '../utils.js';
import {
    $status,
    isNameField,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const count = {
    windows: 1,
    tabs: 1,
    selectedTabs: 1,
};

export const statusType = {
    stashShift: {
        condition: ({ key, type }) => Omnibox.matchedCommand === 'stash' && type === 'keydown' && key === 'Shift',
        content: `<kbd>Shift</kbd>: Stash without closing window`,
    },
    editName: {
        condition: () => EditMode.isActive && isNameField(document.activeElement),
        content: `Edit mode: Type a name then <kbd>▲</kbd>, <kbd>▼</kbd> or <kbd>Enter</kbd> to save`,
    },
    edit: {
        condition: () => EditMode.isActive,
        content: `Edit mode: Click on a window row or navigate with <kbd>▲</kbd> and <kbd>▼</kbd>`,
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

// Find the statusType that meets the current condition and assign its content to the status bar.
//@ (Object) -> (String), state
export function update(event = {}) {
    for (const type in statusType) {
        const { condition, content } = statusType[type];
        if (condition(event)) {
            $status.innerHTML = (typeof content === 'function') ? content() : content;
            return type;
        }
    }
}
