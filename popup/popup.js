import { hasClass } from '../utils.js';
import { $body, $omnibox, $currentWindowRow, isRow, isInput } from './common.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import navigateByArrow from './navigation.js';

const isClickKey = key => key === 'Enter' || key === ' ';
const isOmnibox = $target => $target === $omnibox;
const isCurrentWindowInput = $target => $target === $currentWindowRow.$input;

let modifierHints;

import('./init.js').then(async init => {
    ({ modifierHints } = await init.default());
    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
    $body.addEventListener('focusout', onFocusOut);
});

function onClick(event) {
    const { target: $target } = event;
    const id = $target.id;
    if (id in Toolbar) return Toolbar[id]();
    if (EditMode.handleClick($target)) return;
    if (isCurrentWindowInput($target)) return EditMode.activate();
    Request.action(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}

function onKeyDown(event) {
    const { key, target: $target } = event;
    inputEnterCheck.down(key, $target);
    if (EditMode.$active) return;
    if (navigateByArrow($target, key, event)) return;
    if (showModifierHint(key)) return;
    if (key === 'Tab' || isClickKey(key)) return;
    if (!isOmnibox($target)) $omnibox.focus();
}

function onKeyUp(event) {
    const { key, target: $target } = event;
    inputEnterCheck.up(key, $target);
    if (EditMode.$active) return EditMode.handleKeyUp(key, $target);
    if (isClickKey(key)) {
        if (isCurrentWindowInput($target)) return EditMode.activate();
        if (isRow($target)) return Request.action(event, $target);
    }
    if (isOmnibox($target)) {
        $omnibox.placeholder = '';
        Omnibox.handleKeyUp(key, event);
    }
}

function onFocusOut(event) {
    if (isOmnibox(event.target)) $omnibox.placeholder = '';
}

// Flag if Enter has been keyed down and up both within the same input. A handler should then check and reset the flag (_enter).
// Guards against cases where input receives the keyup after the keydown was invoked elsewhere (usually a button).
const inputEnterCheck = {
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

function showModifierHint(key) {
    if (key === 'Control') key = 'Ctrl';
    const hint = modifierHints[key];
    if (hint) $omnibox.placeholder = hint;
    return hint;
}
