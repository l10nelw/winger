import { $body, $omnibox, $currentWindowRow, isRow } from './common.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import navigateByArrow from './navigation.js';

const clickKeys = ['Enter', ' '];
const isClickKey = key => clickKeys.includes(key);

let modifierHints;

import('./init.js').then(async init => {
    ({ modifierHints } = await init.default());
    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onContextMenu);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);
    $body.addEventListener('input', onInput);
    $body.addEventListener('focusin', onFocusIn);
});

function onClick(event) {
    const { target } = event;

    const id = target.id;
    if (id in Toolbar) return Toolbar[id]();

    if (EditMode.isActive) return;
    if (target === $currentWindowRow.$name) return EditMode.activate();
    Request.action(event, target);
}

function onContextMenu(event) {
    const { target } = event;
    if (target.matches('input:not([readonly])')) return; // Allow right-click only on non-readonly input
    event.preventDefault();
}

function onKeyDown(event) {
    const { key, target } = event;
    if (navigateByArrow(target, key, event)) return;
    if (showModifierHint(key)) return;
}

function onKeyUp(event) {
    const { key, target } = event;
    $omnibox.placeholder = ''; // Clear any hints

    if (EditMode.handleKeyUp(target, key)) return;

    if (target === $omnibox) {
        return Omnibox.handleKeyUp(key, event);
    }

    if (isClickKey(key)) {
        if (target === $currentWindowRow.$name) return EditMode.activate();
        if (isRow(target)) return Request.action(event, target);
    }
}

async function onInput(event) {
    const { target } = event;
    if (await EditMode.handleInput(target)) return;
    if (target === $omnibox) {
        return Omnibox.handleInput(event);
    }
}

function onFocusIn(event) {
    const { target: $focused, relatedTarget: $defocused } = event;
    if ($defocused === $omnibox) $omnibox.placeholder = ''; // Clear any modifier hints when omnibox unfocused
    $focused.select?.();
    if (EditMode.handleFocusIn($focused, $defocused)) return;
}

function showModifierHint(key) {
    if (key === 'Control') key = 'Ctrl';
    const hint = modifierHints[key];
    if (hint) $omnibox.placeholder = hint;
    return hint;
}
