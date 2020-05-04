import { isInput, isButton } from '../utils.js';
import { $currentWindowRow, $otherWindowsList, $footer, getActionAttr } from './popup.js';
import { $omnibox } from './omnibox.js';

const isRow = $el => $el.tagName === 'LI';
const isFocusable = $el => $el.tabIndex !== -1 && !$el.hidden;

const element = {
     // Current button reference ("$action" or null) to remember the last focused row button while navigating rows.
    button: null,
    // Set this.button to a reference if element is button, to null if row, or make no change.
    setButton($el) {
        const action = getActionAttr($el);
        if (action) this.button = isButton($el) ? `$${action}` : null;
    },
    // Return the appropriate button in currentWindowRow, else return row itself.
    currentWindow() {
        let $btn = $currentWindowRow[this.button];
        if ($btn) return $btn;
        $btn = $currentWindowRow.firstElementChild;
        while ($btn && !isFocusable($btn)) {
            $btn = $btn.nextElementSibling;
        }
        return $btn || $currentWindowRow;
    },
    isCurrentWindow($el) {
        return $el.$row === $currentWindowRow || $el === $currentWindowRow;
    },
    footer() {
        return $footer.firstElementChild || $footer;
    },
    isFooter($el) {
        return $el.parentElement === $footer || $el === $footer;
    },
    // Take and return the same row, unless a button can be returned instead.
    rowOrButton($row) {
        if ($row) return $row[this.button] || $row;
    },
};

const navigator = {
    ArrowDown($el) {
        if (element.isFooter($el)) return element.currentWindow();
        if (element.isCurrentWindow($el)) return $omnibox;
        if ($el === $omnibox) return element.rowOrButton($otherWindowsList.firstElementChild);
        const $next = ($el.$row || $el).nextElementSibling;
        return element.rowOrButton($next) || element.footer();
    },
    ArrowUp($el) {
        if ($el === $omnibox) return element.currentWindow();
        if (element.isCurrentWindow($el)) return element.footer();
        if (element.isFooter($el)) return element.rowOrButton($otherWindowsList.lastElementChild);
        const $next = ($el.$row || $el).previousElementSibling;
        return element.rowOrButton($next) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox) return $omnibox;
        if (element.isFooter($el)) return $el.nextElementSibling || $footer.firstElementChild;
        const $next = isRow($el) ? $el.firstElementChild : ($el.nextElementSibling || $el.parentElement);
        element.setButton($next);
        return $next;
    },
    ArrowLeft($el) {
        if ($el === $omnibox) return $omnibox;
        if (element.isFooter($el)) return $el.previousElementSibling || $footer.lastElementChild;
        const $next = isRow($el) ? $el.lastElementChild : ($el.previousElementSibling || $el.parentElement);
        element.setButton($next);
        return $next;
    },
};

export function navigateByArrow(key, $el) {
    if (!(key in navigator)) return;
    const navigatorKey = navigator[key];
    do { $el = navigatorKey($el) } while (!isFocusable($el));
    $el.focus();
    return true;
}

// Flag if Enter has been keyed down and up both within the same input. A handler should then check and reset the flag (_enter).
// Guards against cases where input receives the keyup after the keydown was invoked elsewhere (usually a button).
export const enterCheck = {
    $input: null,
    down(key, $target) {
        if (key === 'Enter' && isInput($target)) {
            this.$input = $target;
        }
    },
    up(key, $target) {
        if (key === 'Enter' && $target === this.$input) {
            $target._enter = true;
            this.$input = null;
        }
    }
};