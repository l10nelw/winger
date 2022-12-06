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

$body.addEventListener('click', onClick);
$body.addEventListener('mousedown', onMouseDown);
$body.addEventListener('contextmenu', onContextMenu);
$body.addEventListener('keydown', onKeyDown);
$body.addEventListener('keyup', onKeyUp);
$body.addEventListener('input', onInput);
$body.addEventListener('focusin', onFocusIn);

//@ (Object) -> state|nil
function onClick(event) {
    const { target } = event;

    if (target.id in Toolbar)
        return Toolbar[target.id]();

    if (EditMode.isActive)
        return;

    if (target === $currentWindowRow.$name)
        return EditMode.toggle();

    Request.action(event, target);
}

//@ (Object) -> state|nil
function onMouseDown(event) {
    const { target } = event;
    if (EditMode.handleMouseDown(target))
        return;
}

//@ (Object) -> state|nil
function onContextMenu(event) {
    const { target } = event;
    // Allow right-click only on non-readonly input
    if (target.matches('input:not([readonly])'))
        return;
    event.preventDefault();
}

//@ (Object) -> state|nil
function onKeyDown(event) {
    const { key, target } = event;
    if (navigateByArrow(target, key, event))
        return;
    if (Omnibox.handleKeyDown(key))
        return;
}

//@ (Object) -> state|nil
function onKeyUp(event) {
    const { key, target } = event;
    $omnibox.placeholder = ''; // Clear any modifier hints

    if (EditMode.handleKeyUp(target, key))
        return;

    if (target === $omnibox)
        return Omnibox.handleKeyUp(key, event);

    if (key === 'Enter') {
        if (target === $currentWindowRow.$name)
            return EditMode.toggle();
        if (isRow(target))
            return Request.action(event, target);
    }
}

//@ (Object) -> state|nil
async function onInput(event) {
    const { target } = event;
    if (await EditMode.handleInput(target))
        return;
    if (target === $omnibox)
        return Omnibox.handleInput(event);
}

//@ (Object) -> state|nil
function onFocusIn(event) {
    const { target: $focused, relatedTarget: $defocused } = event;
    if ($defocused === $omnibox)
        $omnibox.placeholder = ''; // Clear any modifier hints
    if (EditMode.handleFocusIn($focused, $defocused))
        return;
    if ($focused.tabIndex === -1)
        return $defocused.focus();
    $focused.select?.();
    }
