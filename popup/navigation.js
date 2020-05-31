import { $currentWindowRow, $otherWindowsList, $toolbar, isRow, getActionAttr } from './popup.js';
import { $omnibox } from './omnibox.js';
import { isButton } from '../utils.js';

const isFocusable = $el => $el.tabIndex !== -1 && !$el.hidden;

export default function navigateByArrow(key, $el) {
    const navigatorKey = navigator[key];
    if (!navigatorKey) return;
    do { $el = navigatorKey($el) } while (!isFocusable($el));
    $el.focus();
    return true;
}

const navigator = {
    ArrowDown($el) {
        if (isToolbar($el)) return currentWindow();
        if (isCurrentWindow($el)) return $omnibox;
        if ($el === $omnibox) return rowOrButton($otherWindowsList.firstElementChild) || toolbar();
        const $next = ($el.$row || $el).nextElementSibling;
        return rowOrButton($next) || toolbar();
    },
    ArrowUp($el) {
        if ($el === $omnibox) return currentWindow();
        if (isCurrentWindow($el)) return toolbar();
        if (isToolbar($el)) return rowOrButton($otherWindowsList.lastElementChild) || $omnibox;
        const $next = ($el.$row || $el).previousElementSibling;
        return rowOrButton($next) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.nextElementSibling || $toolbar.firstElementChild;
        const $next = isRow($el) ? $el.firstElementChild : ($el.nextElementSibling || $el.parentElement);
        setButton($next);
        return $next;
    },
    ArrowLeft($el) {
        if ($el === $omnibox) return $omnibox;
        if (isToolbar($el)) return $el.previousElementSibling || $toolbar.lastElementChild;
        const $next = isRow($el) ? $el.lastElementChild : ($el.previousElementSibling || $el.parentElement);
        setButton($next);
        return $next;
    },
};

let button = null; // Current button reference ("$action" or null) to remember the last focused row button

// Set button variable to a reference if element is button, to null if row, or make no change.
function setButton($el) {
    const action = getActionAttr($el);
    if (action) button = isButton($el) ? `$${action}` : null;
}

// Take and return the same row (otherWindow), unless a button can be returned instead.
function rowOrButton($row) {
    if ($row) return $row[button] || $row;
}

// Return the appropriate button in currentWindowRow, else return row itself.
function currentWindow() {
    let $btn = $currentWindowRow[button];
    if ($btn) return $btn;
    $btn = $currentWindowRow.firstElementChild;
    while ($btn && !isFocusable($btn)) {
        $btn = $btn.nextElementSibling;
    }
    return $btn || $currentWindowRow;
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
