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
    $body.addEventListener('contextmenu', onContextMenu);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
    $body.addEventListener('focusin', onFocusIn);
});

function onClick(event) {
    const { target } = event;
    const id = target.id;
    if (id in Toolbar) return Toolbar[id]();
    if (EditMode.handleClick(target)) return;
    if (isCurrentWindowInput(target)) return EditMode.activate();
    Request.action(event, target);
}

function onContextMenu(event) {
    const { target } = event;
    if (target.matches('input:not([readonly])')) return; // Allow right-click only on non-readonly input
    event.preventDefault();
    target.blur();
}

function onKeyDown(event) {
    const { key, target } = event;
    if (EditMode.$active) return;
    if (navigateByArrow(target, key, event)) return;
    if (showModifierHint(key)) return;
    if (key === 'Tab' || isClickKey(key)) return;
    if (!isOmnibox(target)) $omnibox.focus();
}

function onKeyUp(event) {
    const { key, target } = event;
    if (EditMode.$active) return EditMode.handleKeyUp(key, target);
    if (isClickKey(key)) {
        if (isCurrentWindowInput(target)) return EditMode.activate();
        if (isRow(target)) return Request.action(event, target);
    }
    if (isOmnibox(target)) {
        $omnibox.placeholder = '';
        Omnibox.handleKeyUp(key, event);
    }
}

function onFocusIn(event) {
    if (isOmnibox(event.relatedTarget)) $omnibox.placeholder = ''; // Clear any modifier hints when omnibox unfocused
}

function showModifierHint(key) {
    if (key === 'Control') key = 'Ctrl';
    const hint = modifierHints[key];
    if (hint) $omnibox.placeholder = hint;
    return hint;
}
