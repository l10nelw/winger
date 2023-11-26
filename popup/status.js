import { isOS } from '../utils.js';
import {
    FLAGS,
    $status,
    isNameField,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const count = {
    windows: 0,
    tabs: 0,
    selectedTabs: 0,
}

const statusType = {
    stashShift: {
        condition: ({ key, type }) => Omnibox.matchedCommand === 'stash' && type === 'keydown' && key === 'Shift',
        content: `<kbd>Shift</kbd>: Stash without closing window`,
    },
    editName: {
        condition: () => EditMode.isActive && isNameField(document.activeElement),
        content: `Edit mode: Type a name then <kbd>▲</kbd> or <kbd>▼</kbd> to save, or <kbd>Enter</kbd> to save and exit`,
    },
    edit: {
        condition: () => EditMode.isActive,
        content: `Edit mode: Click on a window row or navigate with <kbd>▲</kbd> and <kbd>▼</kbd>. Enter <samp>/edit</samp> to exit`,
    },
    bring: {
        condition: ({ key, type }) => type === 'keydown' && key === 'Shift',
        content: () => `<kbd>Shift</kbd>: Bring ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    send: {
        condition: ({ key, type }) => type === 'keydown' && key === 'Control',
        content: () => `<kbd>Ctrl</kbd>: Send ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    oneWindow: {
        condition: () => count.windows === 1,
        content: `1 window &ndash; Press <kbd>${isOS('Mac OS') ? 'Cmd' : 'Ctrl'}</kbd>+<kbd>N</kbd> to add another!`,
    },
    default: {
        condition: () => true,
        content: () => {
            const summary = `${count.windows} windows / ${count.tabs} ${count.tabs === 1 ? 'tab' : 'tabs'}`;
            return count.selectedTabs > 1 ? `${summary} (${count.selectedTabs} selected)` : summary;
        },
    },
}

//@ ([Object], Number, {Boolean}), state -> state
export async function init(currentWinfo, otherWinfos) {
    if (!FLAGS.enable_stash)
        delete statusType.stashShift;

    count.windows = 1 + otherWinfos.length;
    count.selectedTabs = currentWinfo.selectedTabCount;
    count.tabs = currentWinfo.tabCount;
    for (const winfo of otherWinfos)
        count.tabs += winfo.tabCount;
    update();
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
