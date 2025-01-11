import { isOS } from '../utils.js';
import {
    FLAGS,
    $status,
    isNameField,
    $omnibox,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as EditMode from './editmode.js';

const count = {
    windows: 0,
    tabs: 0,
    selectedTabs: 0,
}

const ctrlCmd = isOS('Mac OS') ? 'Ctrl' : 'Cmd';

// Dict of memoized subconditions used while seeking a matching hintType condition.
const sc = {
    reset() { for (const subcondition in sc) delete sc[subcondition].cache; },
    isKeydown: event => sc.isKeydown.cache ??= event.type === 'keydown',
    isKeydownCtrl: event => sc.isKeydownCtrl.cache ??= sc.isKeydown(event) && event.key === 'Control',
    isKeydownShift: event => sc.isKeydownShift.cache ??= sc.isKeydown(event) && event.key === 'Shift',
    isKeydownCtrlShift: event => sc.isKeydownCtrlShift.cache ??=
        event.ctrlKey && event.shiftKey && (sc.isKeydownCtrl(event) || sc.isKeydownShift(event)),
    action: event => sc.action.cache ??= event.target?.dataset.action || '',
    isStashAction: event => sc.isStashAction.cache ??= sc.action(event) === 'stash',
    isStashCommand: () => sc.isStashCommand.cache ??= Omnibox.Parsed.command === 'stash',
    isRowStashed: event => sc.isRowStashed.cache ??= event.target?.closest('li')?.matches('.stashed') || false,
    isTopRowStashed: event => sc.isTopRowStashed.cache ??=
        event.target === $omnibox && !Omnibox.Parsed.command && Filter.$shownRows[0]?.matches('.stashed') || false,
    isDestinationStashed: event => sc.isDestinationStashed.cache ??= sc.isRowStashed(event) || sc.isTopRowStashed(event),
}

const hintType = {
    edit: {
        condition: () => EditMode.isActive,
        content: event => isNameField(event.target) ?
            `Edit mode: Type a name then <kbd>▲</kbd> or <kbd>▼</kbd> to save, or <kbd>Enter</kbd> to save and exit edit mode` :
            `Edit mode: Click on a window row or navigate with <kbd>▲</kbd> and <kbd>▼</kbd>. Enter <samp>/edit</samp> to exit edit mode`,
    },
    stashCopyTab: {
        condition: event => sc.isKeydownCtrlShift(event) && !sc.isStashAction(event) && sc.isDestinationStashed(event),
        content: () => `<kbd>Ctrl</kbd>+<kbd>Shift</kbd>: Stash-copy ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    sendCopyTab: {
        condition: event => sc.isKeydownShift(event) && sc.isRowStashed(event) && sc.action(event) === 'send',
        content: () => `<kbd>Shift</kbd>: Stash-copy ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    unstashCopy: {
        condition: event => sc.isKeydownShift(event) && sc.isRowStashed(event) && sc.isStashAction(event),
        content: () => `<kbd>Shift</kbd>: Unstash-copy window`,
    },
    stashCopy: {
        condition: event => sc.isKeydownShift(event) && (sc.isStashCommand() || sc.isStashAction(event)),
        content: () => `<kbd>Shift</kbd>: Stash-copy window`,
    },
    send: {
        condition: event => sc.isKeydownCtrl(event) && !sc.isStashCommand() && !sc.isStashAction(event),
        content: () => `<kbd>Ctrl</kbd>: Send ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    bring: {
        condition: event => sc.isKeydownShift(event) && !sc.isDestinationStashed(event),
        content: () => `<kbd>Shift</kbd>: Bring ${count.selectedTabs === 1 ? 'tab' : 'tabs'} to...`,
    },
    oneWindow: {
        condition: () => count.windows === 1,
        content: () => `1 window &ndash; Press <kbd>${ctrlCmd}</kbd>+<kbd>N</kbd> to add another!`,
    },
    default: {
        condition: () => true,
        content: () => {
            const summary = `${count.windows} windows / ${count.tabs} ${count.tabs === 1 ? 'tab' : 'tabs'}`;
            return count.selectedTabs > 1 ? `${summary} (${count.selectedTabs} selected)` : summary;
        },
    },
}

//@ (Object, [Object]), state -> state
export async function init(fgWinfo, bgWinfos) {
    if (!FLAGS.enable_stash) {
        for (const subcondition in sc)
            if (subcondition.includes('stash'))
                sc[subcondition] = () => false;
        for (const type in hintType)
            if (type.includes('copy'))
                delete hintType[type];
    }

    count.windows = 1 + bgWinfos.length;
    count.selectedTabs = fgWinfo.selectedTabCount;
    count.tabs = fgWinfo.tabCount;
    for (const winfo of bgWinfos)
        count.tabs += winfo.tabCount;

    update();
}

// Find the hintType that meets the current condition and assign its content to the status bar.
//@ (Object) -> (String), state
export function update(event = {}) {
    sc.reset();
    for (const type in hintType) {
        const hint = hintType[type];
        if (hint.condition(event)) {
            $status.innerHTML = hint.content(event);
            return type;
        }
    }
}
