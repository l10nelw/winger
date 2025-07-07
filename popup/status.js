import {
    FLAGS,
    $status,
    isNameField,
    $omnibox,
} from './common.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Omnibox from './omnibox.js';

import { isOS } from '../utils.js';

const count = {
    windows: 0,
    tabs: 0,
    selectedTabs: 0,
}

const ctrlCmd = isOS('Mac OS') ? 'Ctrl' : 'Cmd';
const tabOrTabs = (all = false) => ((all ? count.tabs : count.selectedTabs) === 1) ? 'tab' : 'tabs';

/**
 * Dict of memoized subconditions used while seeking a matching hintType condition.
 * @type {Object<string, (event: KeyboardEvent) => boolean | string>}
 */
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

/**
 * Either `[text]` for a TextNode or `[text, tag]` for an HTMLElement.
 * An array of these is used to represent a Hint's content and generate its DOM form for $status.
 * This is all to avoid using `$status.innerHTML = content`.
 * @typedef {[string] | [string, string]} ContentNode
 */
/**
 * @typedef Hint
 * @property {(event?: KeyboardEvent) => boolean} condition
 * @property {() => ContentNode[]} content
 */

/**
 * @type {Object<string, Hint>}
 */
const hintType = {
    edit: {
        condition: () => EditMode.isActive,
        content: event => isNameField(event.target) ?
            [[`Edit mode: Type a name then `], ['▲', 'kbd'], [` or `], ['▼', 'kbd'], [`to save, or `], ['Enter', 'kbd'], [` to save and exit edit mode`]] :
            [[`Edit mode: Click on a window row or navigate with `], ['▲', 'kbd'], [` `], ['▼', 'kbd'], [`. Enter `], ['/edit', 'samp'], [` to exit edit mode`]],
    },
    stashCopyTab: {
        condition: event => sc.isKeydownCtrlShift(event) && !sc.isStashAction?.(event) && sc.isDestinationStashed?.(event),
        content: () => [['Ctrl', 'kbd'], [`+`], ['Shift', 'kbd'], [`: Stash-copy ${tabOrTabs()} to...`]],
    },
    sendCopyTab: {
        condition: event => sc.isKeydownShift(event) && sc.isRowStashed?.(event) && sc.action(event) === 'send',
        content: () => [['Shift', 'kbd'], [`: Stash-copy ${tabOrTabs()} to...`]],
    },
    unstashCopy: {
        condition: event => sc.isKeydownShift(event) && sc.isRowStashed?.(event) && sc.isStashAction?.(event),
        content: () => [['Shift', 'kbd'], [`: Unstash-copy window`]],
    },
    stashCopy: {
        condition: event => sc.isKeydownShift(event) && (sc.isStashCommand?.() || sc.isStashAction?.(event)),
        content: () => [['Shift', 'kbd'], [`: Stash-copy window`]],
    },
    send: {
        condition: event => sc.isKeydownCtrl(event) && !sc.isStashCommand?.() && !sc.isStashAction?.(event),
        content: () => [['Ctrl', 'kbd'], [`: Send ${tabOrTabs()} to...`]],
    },
    bring: {
        condition: event => sc.isKeydownShift(event) && !sc.isDestinationStashed?.(event),
        content: () => [['Shift', 'kbd'], [`: Bring ${tabOrTabs()} to...`]],
    },
    oneWindow: {
        condition: () => count.windows === 1,
        content: () => [[`1 window – Press `], [ctrlCmd, 'kbd'], [`+`], ['N', 'kbd'], [` to open another!`]],
    },
    default: {
        condition: () => true,
        content: () => {
            const summary = `${count.windows} windows / ${count.tabs} ${tabOrTabs(true)}`;
            return [[count.selectedTabs > 1 ? `${summary} (${count.selectedTabs} selected)` : summary]];
        },
    },
}

/**
 * @param {ContentNode[]} contentNodes
 * @returns {DocumentFragment}
 */
function buildHintContent(contentNodes) {
    const $fragment = document.createDocumentFragment();
    for (const [textContent, tag] of contentNodes)
        $fragment.append(
            tag ? Object.assign(document.createElement(tag), { textContent })
                : textContent
        );
    return $fragment;
}

/**
 * @param {Object} fgWinfo
 * @param {Object[]} bgWinfos
 * @modifies count
 */
export async function init(fgWinfo, bgWinfos) {
    if (!FLAGS.enable_stash) {
        for (const subcondition in sc)
            if (subcondition.includes('stash'))
                delete sc[subcondition];
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

/**
 * Find the hintType that meets the current condition and assign its content to the status bar.
 * @param {KeyboardEvent} [event={}]
 * @returns {string?}
 */
export function update(event = {}) {
    sc.reset();
    for (const type in hintType) {
        const hint = hintType[type];
        if (hint.condition(event)) {
            const $content = buildHintContent(hint.content(event));
            $status.replaceChildren($content);
            return type;
        }
    }
}
