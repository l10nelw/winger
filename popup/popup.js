import { hasClass } from '../utils.js';
import { $body, $currentWindowRow, isRow, isInput } from './common.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import navigateByArrow from './navigation.js';

const { $omnibox } = Omnibox;
const isClickKey = key => key === 'Enter' || key === ' ';

let modifierHints;

import('./init.js').then(async init => {
    ({ modifierHints } = await init.default());
    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
    $body.addEventListener('focusout', onFocusOut);
    $currentWindowRow.$input.addEventListener('dblclick', onDoubleClick);
});

function onClick(event) {
    const { target: $target } = event;
    const id = $target.id;
    if (id in Toolbar) return Toolbar[id]();
    if (EditMode.handleClick($target)) return;
    Request.action(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}


function onKeyDown(event) {
    const { key, target: $target } = event;
    inputEnterCheck.down(key, $target);
    if (EditMode.$active) return;
    if (navigateByArrow($target, key)) return;
    if (showModifierHint(key)) return;
    if (key === 'Tab' || isClickKey(key)) return;
    if ($target !== $omnibox) $omnibox.focus();
}

function onKeyUp(event) {
    const { key, target: $target } = event;
    inputEnterCheck.up(key, $target);
    if (EditMode.$active) return EditMode.handleKeyUp(key, $target);
    if (isRow($target) && isClickKey(key)) return Request.action(event, $target);
    if ($target === $omnibox) {
        Omnibox.placeholder();
        Omnibox.handleKeyUp(key, event);
    }
}

function onFocusOut(event) {
    if (event.target === $omnibox) Omnibox.placeholder();
}

function onDoubleClick() {
    if (!EditMode.$active) EditMode.activate();
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
    Omnibox.placeholder(hint);
    return hint;
}
