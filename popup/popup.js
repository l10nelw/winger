import * as Init from './init.js';
import {
    $body,
    $currentWindowRow,
    isRow,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Toolbar from './toolbar.js';
import * as Status from './status.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import navigateByKey from './navigation.js';

$body.addEventListener('click', onClick);
$body.addEventListener('mousedown', onMouseDown);
$body.addEventListener('contextmenu', onContextMenu);
$body.addEventListener('keydown', onKeyDown);
$body.addEventListener('keyup', onKeyUp);
$body.addEventListener('input', onInput);
$body.addEventListener('focusin', onFocusIn);
Init.init();

//@ (Object) -> state|nil
function onClick(event) {
    const { target } = event;
    if (target.id in Toolbar)
        return Toolbar[target.id]();
    if (EditMode.isActive)
        return Status.update(event);
    if (target === $currentWindowRow.$name) {
        EditMode.toggle();
        Status.update(event);
        return;
    }
    Request.action({ event, $action: target });
}

//@ (Object) -> state|nil
function onMouseDown(event) {
    if (EditMode.handleMouseDown(event.target))
        return;
}

//@ (Object) -> state|nil
function onContextMenu(event) {
    // Allow right-click only on non-readonly input
    if (event.target.matches('input:not([readonly])'))
        return;
    event.preventDefault();
}

//@ (Object) -> state|nil
function onKeyDown(event) {
    if (Omnibox.handleKeyDown(event))
        return;
    navigateByKey(event);
    if (Init.completed)
        Status.update(event);
}

//@ (Object) -> state|nil
function onKeyUp(event) {
    if (!Init.completed)
        return;
    (() => {
        if (EditMode.handleKeyUp(event))
            return;
        if (Omnibox.handleKeyUp(event))
            return;
        if (event.key === 'Enter') {
            const { target } = event;
            if (target === $currentWindowRow.$name)
                return EditMode.toggle();
            if (isRow(target))
                return Request.action({ event, $action: target });
        }
    })();
    Status.update(event);
}

//@ (Object) -> state|nil
function onInput(event) {
    if (Omnibox.handleInput(event, Init.completed))
        return;
    if (EditMode.handleInput(event.target))
        return;
}

//@ (Object) -> state|nil
function onFocusIn(event) {
    const { target: $focused, relatedTarget: $defocused } = event;
    if (EditMode.handleFocusIn($focused, $defocused))
        return;
    if ($focused.tabIndex === -1)
        return $defocused.focus();
    $focused.select?.();
}
