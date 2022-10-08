import './init.js';
import {
    $body,
    $omnibox,
    $currentWindowRow,
    isRow,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import navigateByArrow from './navigation.js';

const CLICK_KEYS = ['Enter', ' '];
const isClickKey = key => CLICK_KEYS.includes(key); //@ (String) -> (Boolean)

$body.addEventListener('click', onClick);
$body.addEventListener('contextmenu', onContextMenu);
$body.addEventListener('keydown', onKeyDown);
$body.addEventListener('keyup', onKeyUp);
$body.addEventListener('input', onInput);
$body.addEventListener('focusin', onFocusIn);

//@ (Object) -> state|null
function onClick(event) {
    const { target } = event;

    const id = target.id;
    if (id in Toolbar) return Toolbar[id]();

    if (EditMode.isActive) return;
    if (target === $currentWindowRow.$name) return EditMode.activate();
    Request.action(event, target);
}

//@ (Object) -> state|null
function onContextMenu(event) {
    const { target } = event;
    if (target.matches('input:not([readonly])')) return; // Allow right-click only on non-readonly input
    event.preventDefault();
}

//@ (Object) -> state|null
function onKeyDown(event) {
    const { key, target } = event;
    if (navigateByArrow(target, key, event)) return;
    if (Omnibox.handleKeyDown(key)) return;
}

//@ (Object) -> state|null
function onKeyUp(event) {
    const { key, target } = event;
    $omnibox.placeholder = ''; // Clear any modifier hints

    if (EditMode.handleKeyUp(target, key)) return;

    if (target === $omnibox) {
        return Omnibox.handleKeyUp(key, event);
    }

    if (isClickKey(key)) {
        if (target === $currentWindowRow.$name) return EditMode.activate();
        if (isRow(target)) return Request.action(event, target);
    }
}

//@ (Object) -> state|null
async function onInput(event) {
    const { target } = event;
    if (await EditMode.handleInput(target)) return;
    if (target === $omnibox) {
        return Omnibox.handleInput(event);
    }
}

//@ (Object) -> state|null
function onFocusIn(event) {
    const { target: $focused, relatedTarget: $defocused } = event;
    if ($defocused === $omnibox) $omnibox.placeholder = ''; // Clear any modifier hints
    $focused.select?.();
    if (EditMode.handleFocusIn($focused, $defocused)) return;
}
