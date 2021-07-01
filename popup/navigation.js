import { $currentWindowRow, $otherWindowsList, $toolbar, isButton, isRow, getActionAttr } from './common.js';
import { $omnibox } from './omnibox.js';

const isFocusable = $el => $el.tabIndex !== -1 && !$el.hidden;
const isVerticalKey = key => ['ArrowDown', 'ArrowUp'].includes(key);

// Given element and an arrow key, focus on another element in that direction and return true.
// Return null if key not an arrow key.
export default function navigateByArrow($el, key) {
    const navigatorKey = navigator[key];
    if (!navigatorKey) return;
    do { $el = navigatorKey($el) } while (!isFocusable($el)); // Repeat in same direction until focusable element found
    if (!isVerticalKey(key)) setColumn($el);
    $el.focus();
    return true;
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

let column;

// Set `column` to: null if row, a reference ("send", etc) if cell, or no change.
function setColumn($el) {
    column =
        isRow($el) ? null :
        isButton($el) ? getActionAttr($el) :
        column;
}

// Take and return the same row, unless a cell can be returned instead.
function rowOrCell($row) {
    return $row?.[`$${column}`] || $row;
}

// Element's parent row, else assume element is a row.
function row($el) {
    return $el.$row || $el;
}

// Return the appropriate cell in currentWindowRow, else return row itself.
function currentWindow() {
    let $cell = $currentWindowRow[`$${column}`];
    if ($cell) return $cell;
    $cell = $currentWindowRow.firstElementChild;
    while ($cell && !isFocusable($cell)) {
        $cell = $cell.nextElementSibling;
    }
    return $cell || $currentWindowRow;
}

function toolbar() {
    return $toolbar.firstElementChild || $toolbar;
}

function isCurrentWindow($el) {
    return $el.$row === $currentWindowRow || $el === $currentWindowRow;
}

function isToolbar($el) {
    return $el.parentElement === $toolbar || $el === $toolbar;
}
