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

/** @import { WindowRow$ } from './common.js' */
/** @typedef {string} Key */

/**
 * @callback KeyProcessor
 * @param {HTMLElement} $el
 * @param {KeyboardEvent} event
 * @returns {HTMLElement}
 */

const SCROLL_THRESHOLD = 5; // Scrolling is suppressed unless focused row is this number of rows from the start or end
const HORIZONTAL_KEYS = ['ArrowRight', 'ArrowLeft'];
const VERTICAL_KEYS = ['ArrowDown', 'ArrowUp'];

/** @param {HTMLElement} $el @returns {boolean} */ const isUnfocusable = $el => row($el).hidden || $el.tabIndex === -1;
/** @param {Key} key @returns {boolean} */         const isHorizontalKey = key => HORIZONTAL_KEYS.includes(key);
/** @param {Key} key @returns {boolean} */         const isVerticalKey = key => VERTICAL_KEYS.includes(key);

/**
 * Upon an arrow or tab keydown, focus on the next focusable element in that direction and return true.
 * Control vertical scrolling.
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleKeyDown(event) {
    /** @type {Key} */ const key = event.key;
    /** @type {HTMLElement} */ let $el = event.target;

    if (isHorizontalKey(key) && isField($el) && !$el.readOnly)
        return false;

    const navigatorKey = Navigator[key];
    if (!navigatorKey)
        return false;

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

/**
 * @param {KeyboardEvent} event
 * @returns {boolean?}
 */
export function handleKeyUp(event) {
    if (event.key === 'Tab') {
        setColumn(event.target);
        return true;
    }
}

/**
 * Prevent scrolling if focus is on first/last few rows, to control the default scoll-ahead.
 * @param {HTMLElement} $el
 * @param {KeyboardEvent} event
 */
function restrictScroll($el, event) {
    const index = $shownRows.indexOf(row($el));
    if (index < SCROLL_THRESHOLD || ($shownRows.length - index) <= SCROLL_THRESHOLD)
        event.preventDefault(); // Suppress scrolling
}

/**
 * Currently-focused button column e.g. "send", "bring".
 * @type {string?}
 */
let column;

/**
 * @param {HTMLElement} $el
 * @modifies column
 */
function setColumn($el) {
    column =
        isRow($el) || isField($el) ? null : // if row or name: null
        isButton($el) ? $el.dataset.action : // if cell: its action reference ("send", etc)
        column; // no change
}

/**
 * @type {Object<Key, KeyProcessor>}
 */
const Navigator = {

    /** @type {KeyProcessor} */
    ArrowDown($el) {
        if (isInToolbar($el))
            return currentWindow();
        if (isCurrentWindow($el))
            return $omnibox;
        if (isOmnibox($el))
            return rowOrCell($shownRows[0]) || toolbar();
        const $nextRow = row($el).nextElementSibling;
        return rowOrCell($nextRow) || toolbar();
    },

    /** @type {KeyProcessor} */
    ArrowUp($el) {
        if (isOmnibox($el))
            return currentWindow();
        if (isCurrentWindow($el))
            return toolbar();
        if (isInToolbar($el))
            return rowOrCell($shownRows.at(-1)) || $omnibox;
        const $nextRow = row($el).previousElementSibling;
        return rowOrCell($nextRow) || $omnibox;
    },

    /** @type {KeyProcessor} */
    ArrowRight($el) {
        if (isOmnibox($el))
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.nextElementSibling || $toolbar.querySelector('button');
        return isRow($el) ? $el.firstElementChild :
            ($el.nextElementSibling || $el.$row);
    },

    /** @type {KeyProcessor} */
    ArrowLeft($el) {
        if (isOmnibox($el))
            return $omnibox;
        if (isEditMode && isField($el))
            return $el;
        if (isInToolbar($el))
            return $el.previousElementSibling || $toolbar.querySelector('button:last-child');
        return isRow($el) ? $el.lastElementChild :
            ($el.previousElementSibling || $el.$row);
    },

    /** @type {KeyProcessor} */
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
            if (isOmnibox($el)) {
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

/**
 * Return cell at given row and current column.
 * Uses {string?} `column`
 * @param {WindowRow$?} $row
 * @returns {HTMLElement?}
 */
function columnCell($row) {
    /** @type {HTMLElement?} */
    const $cell = $row?.['$'+column];
    if ($cell && !$cell.disabled)
        return $cell;
}

/**
 * Take and return row, unless a cell can be returned instead.
 * Uses {boolean} `isEditMode`
 * @param {WindowRow$} $row
 * @returns {WindowRow$ | HTMLElement}
 */
const rowOrCell = $row => isEditMode && $row?.$name || columnCell($row) || $row;

/**
 * Element's parent row, else assume element is a row.
 * @param {HTMLElement} $el
 * @returns {WindowRow$}
 */
const row = $el => $el.$row || $el;

/** @returns {HTMLElement} */ const currentWindow = () => columnCell($currentWindowRow) || $currentWindowRow.$name || $currentWindowRow;
/** @returns {HTMLElement} */ const toolbar = () => $toolbar.querySelector('button') || $toolbar;

/** @param {HTMLElement} $el @returns {boolean} */ const isCurrentWindow = $el => row($el) === $currentWindowRow;
/** @param {HTMLElement} $el @returns {boolean} */ const isOmnibox = $el => $el === $omnibox;
