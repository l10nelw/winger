import { isInput, isButton } from '../utils.js';
import { $currentWindowRow, $otherWindowsList, $footer, getActionAttr, getActionElements } from './popup.js';
import { $omnibox } from './omnibox.js';

const button = {
    list: null, // List of an otherRow's button references.
    current: null, // Currrent button reference ("$action").
    getReference($el) {
        const action = isButton($el) && getActionAttr($el);
        if (action) return `$${action}`;
    },
    makeList() {
        this.list = this.list || [...getActionElements($otherWindowsList.firstElementChild)].map(this.getReference);
    },
    set($el) {
        this.current = this.getReference($el);
    },
    // Shift the current button reference left or right.
    offset(amount) {
        const list = this.list;
        const i = list.indexOf(this.current) + amount;
        this.current = i === -2 ? list[list.length-1] : i >= 0 && i < list.length && list[i];
        // No btn +1 = first btn. No btn -1 = last btn. Btn +1/-1 = next btn or no btn.
    },
    // Return the appropriate button element in the currentWindowRow.
    currentWindow() {
        let $btn = $currentWindowRow[this.current];
        if ($btn) return $btn;
        for (const btn of this.list) {
            $btn = $currentWindowRow[btn];
            if ($btn) return $btn;
        }
    },
    // Take and return the same row element, unless a button element should be returned instead.
    orRow($row) {
        if ($row) return $row[this.current] || $row;
    }
};

const getNextElement = {
    ArrowDown($el) {
        if ($el === $omnibox) return button.orRow($otherWindowsList.firstElementChild);
        if ($el.$row === $currentWindowRow) return $omnibox;
        if ($el.parentElement === $footer) return button.currentWindow() || $omnibox;
        // $el is in $otherWindowsList:
        const $nextRow = ($el.$row || $el).nextElementSibling;
        button.set($el);
        return button.orRow($nextRow) || $footer.firstElementChild;
    },
    ArrowUp($el) {
        if ($el === $omnibox) return button.currentWindow() || $footer.firstElementChild;
        if ($el.$row === $currentWindowRow) return $footer.firstElementChild;
        if ($el.parentElement === $footer) return $otherWindowsList.lastElementChild;
        // $el is in $otherWindowsList:
        const $nextRow = ($el.$row || $el).previousElementSibling;
        button.set($el);
        return button.orRow($nextRow) || $omnibox;
    },
    ArrowRight($el) {
        if ($el === $omnibox) return;
        if ($el.parentElement === $footer) return $el.nextElementSibling || $footer.firstElementChild;
        button.offset(1);
        if ($el.$row === $currentWindowRow) return button.currentWindow();
        // $el is in $otherWindowsList:
        return button.orRow($el.$row || $el);
    },
    ArrowLeft($el) {
        if ($el === $omnibox) return;
        if ($el.parentElement === $footer) return $el.previousElementSibling || $footer.lastElementChild;
        button.offset(-1);
        if ($el.$row === $currentWindowRow) return button.currentWindow();
        // $el is in $otherWindowsList:
        return button.orRow($el.$row || $el);
    },
};

export function navigateByArrow(key, $el) {
    if (!(key in getNextElement)) return;
    button.makeList();
    const $next = getNextElement[key]($el);
    if (!$next) return;
    $next.focus();
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