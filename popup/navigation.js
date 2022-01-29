import { $currentWindowRow, $otherWindowsList, $omnibox, $toolbar, isButton, isRow, getActionAttr } from './common.js';
import { $shownRows } from './filter.js';

const SCROLL_THRESHOLD = 5; // Scrolling is suppressed unless focused row is this number of rows from the start or end

// Given an element and an arrow key, focus on the next focusable element in that direction and return true.
// Return null if key not an arrow key.
// Control vertical scrolling.
export default function navigateByArrow($el, key, event) {
    const navigatorKey = navigator[key];
    if (!navigatorKey) return;

     // Repeat in same direction until focusable element found
    do { $el = navigatorKey($el) } while (isUnfocusable($el));

    if (isVerticalKey(key)) {
        restrictScroll($el, event);
    } else {
        setColumn($el);
    }

    $el.focus();
    return true;
}

const isUnfocusable = $el => row($el).hidden || $el.tabIndex === -1;
const isVerticalKey = key => ['ArrowDown', 'ArrowUp'].includes(key);

function restrictScroll($el, event) {
    const index = row($el)._index;
    if (SCROLL_THRESHOLD <= index && ($shownRows.length - index) > SCROLL_THRESHOLD) return;
    event.preventDefault(); // Suppress scrolling
}

let column; // Currently-focused button column
function setColumn($el) {
    column =
        isRow($el) ? null : // if row: null
        isButton($el) ? getActionAttr($el) : // if cell: its action reference ("send", etc)
        column; // no change
}

const navigator = {
    ArrowDown($el) {
        if (isToolbar($el)) return currentWindow();
        if (isCurrentWindow($el)) return $omnibox;
        if ($el === $omnibox) return rowOrCell($otherWindowsList.firstElementChild) || toolbar();
        const $nextRow = row($el).nextElementSibling;
        return rowOrCell($nextRow) || toolbar();
    },
    ArrowUp($el) {
        if ($el === $omnibox) return currentWindow();
        if (isCurrentWindow($el)) return toolbar();
        if (isToolbar($el)) return rowOrCell($otherWindowsList.lastElementChild) || $omnibox;
        const $nextRow = row($el).previousElementSibling;
        return rowOrCell($nextRow) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.nextElementSibling || $toolbar.firstElementChild;
        return isRow($el) ? $el.firstElementChild : ($el.nextElementSibling || $el.$row);
    },
    ArrowLeft($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.previousElementSibling || $toolbar.lastElementChild;
        return isRow($el) ? $el.lastElementChild : ($el.previousElementSibling || $el.$row);
    },
};

const rowOrCell = $row => $row?.['$'+column] || $row; // Take and return row, unless a cell can be returned instead.
const row = $el => $el.$row || $el; // Element's parent row, else assume element is a row.

const currentWindow = () => $currentWindowRow.$name || $currentWindowRow;
const toolbar = () => $toolbar.firstElementChild || $toolbar;

const isCurrentWindow = $el => $el.$row === $currentWindowRow || $el === $currentWindowRow;
const isToolbar = $el => $el.parentElement === $toolbar || $el === $toolbar;
