import {
    $currentWindowRow,
    $omnibox,
    $toolbar,
    isButton,
    isRow,
    isField,
    isInToolbar,
    isNameField,
} from './common.js';
import { isActive as isEditMode } from './editmode.js';
import { $shownRows } from './filter.js';

const SCROLL_THRESHOLD = 5; // Scrolling is suppressed unless focused row is this number of rows from the start or end
const HORIZONTAL_KEYS = ['ArrowRight', 'ArrowLeft'];
const VERTICAL_KEYS = ['ArrowDown', 'ArrowUp'];

// Upon an arrow or tab keydown, focus on the next focusable element in that direction and return true.
// Return nothing if key not an arrow or tab.
// Control vertical scrolling.
//@ (Object), state -> (Boolean), state|nil
export function handleKeyDown(event) {
    const key = event.key;
    let $el = event.target;

    if (isEditMode && isHorizontalKey(key) && isField($el))
        return;

    const navigatorKey = navigator[key];
    if (!navigatorKey)
        return;

    // Repeat in same direction until focusable element found
    do {
        $el = navigatorKey($el, event);
    } while (isUnfocusable($el));

    isVerticalKey(key)
        ? restrictScroll($el, event)
        : setColumn($el);

    $el.focus();
    $el.select?.();
    return true;
}

//@ (Object), state -> (Boolean), state|nil
export function handleKeyUp(event) {
    if (event.key === 'Tab') {
        setColumn(event.target);
        return true;
    }
}

const isUnfocusable = $el => row($el).hidden || $el.tabIndex === -1; //@ (Object) -> (Boolean)
const isHorizontalKey = key => HORIZONTAL_KEYS.includes(key); //@ (String) -> (Boolean)
const isVerticalKey = key => VERTICAL_KEYS.includes(key); //@ (String) -> (Boolean)


// Prevent scrolling if focus is on first/last few rows, to control the default scoll-ahead
//@ (Object, Object) -> state|nil
function restrictScroll($el, event) {
    const index = $shownRows.indexOf($el);
    if (index < SCROLL_THRESHOLD || ($shownRows.length - index) <= SCROLL_THRESHOLD)
        event.preventDefault(); // Suppress scrolling
}

let column; // Currently-focused button column
//@ (Object) -> state
function setColumn($el) {
    column =
        isRow($el) || isField($el) ? null : // if row or name: null
        isButton($el) ? $el.dataset.action : // if cell: its action reference ("send", etc)
        column; // no change
}

//@ (Object) -> (Object)
const navigator = {
    ArrowDown($el) {
        if (isInToolbar($el))
            return currentWindow();
        if (isCurrentWindow($el))
            return $omnibox;
        if ($el === $omnibox)
            return rowOrCell($shownRows[0]) || toolbar();
        const $nextRow = row($el).nextElementSibling;
        return rowOrCell($nextRow) || toolbar();
    },
    ArrowUp($el) {
        if ($el === $omnibox)
            return currentWindow();
        if (isCurrentWindow($el))
            return toolbar();
        if (isInToolbar($el))
            return rowOrCell($shownRows.at(-1)) || $omnibox;
        const $nextRow = row($el).previousElementSibling;
        return rowOrCell($nextRow) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox)
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.nextElementSibling || $toolbar.querySelector('button');
        return isRow($el) ? $el.firstElementChild :
            ($el.nextElementSibling || $el.$row);
    },
    ArrowLeft($el) {
        if ($el === $omnibox)
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.previousElementSibling || $toolbar.querySelector('button:last-child');
        return isRow($el) ? $el.lastElementChild :
            ($el.previousElementSibling || $el.$row);
    },
    Tab($el, event) {
        if (event.shiftKey) {
            if (isCurrentWindow($el)) {
                event.preventDefault();
                return toolbar();
            }
            if (isEditMode && isNameField($el)) {
                const $row = $el.$row;
                if ($row === $shownRows[0]) {
                    event.preventDefault();
                    return $omnibox;
                }
                return $row.previousElementSibling.$name;
            }
            return $el;
        }
        if (isInToolbar($el)) {
            event.preventDefault();
            return currentWindow();
        }
        if (isEditMode) {
            if ($el === $omnibox) {
                event.preventDefault();
                return $shownRows[0]?.$name || toolbar();
            }
            if (isNameField($el)) {
                const $row = $el.$row;
                if ($row !== $currentWindowRow && $row !== $shownRows.at(-1)) {
                    // A name field that is not the first or last
                    event.preventDefault();
                    return $row.nextElementSibling.$name;
                }
            }
        }
        return $el;
    },
}

// Return cell at given row and current column.
//@ (Object), state -> (Object|undefined)
function columnCell($row) {
    const $cell = $row?.['$'+column];
    if ($cell && !$cell.disabled)
        return $cell;
}
// Take and return row, unless a cell can be returned instead.
//@ (Object), state -> (Object|undefined)
const rowOrCell = $row => isEditMode && $row?.$name || columnCell($row) || $row;
//@ state -> (Object)
const currentWindow = () => columnCell($currentWindowRow) || $currentWindowRow.$name || $currentWindowRow;
// Element's parent row, else assume element is a row.
//@ (Object) -> (Object)
const row = $el => $el.$row || $el;
//@ -> (Object)
const toolbar = () => $toolbar.querySelector('button') || $toolbar;

//@ (Object) -> (Boolean)
const isCurrentWindow = $el => row($el) === $currentWindowRow;
