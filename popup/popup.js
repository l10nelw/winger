import {
    FLAGS,
    $body,
    $currentWindowRow,
    $omnibox,
    $otherWindowsList,
    $toolbar,
    $status,
    isButton,
    isRow,
} from './common.js';
import * as EditMode from './editmode.js';
import * as Navigation from './navigation.js';
import * as Omnibox from './omnibox.js';
import * as Row from './row.js';
import * as Request from './request.js';
import * as Status from './status.js';
import * as Toolbar from './toolbar.js';

import * as Modifier from '../modifier.js';

Request.popup().then(init, initError);
$body.addEventListener('click', onClick);
$body.addEventListener('mousedown', onMouseDown);
$body.addEventListener('contextmenu', onContextMenu);
$body.addEventListener('keydown', onKeyDown);
$body.addEventListener('keyup', onKeyUp);
$body.addEventListener('input', onInput);
$body.addEventListener('focusin', onFocusIn);

/**
 * @param {import('../types.js').PopupInitMessage}
 */
async function init({ fgWinfo, bgWinfos, config }) {
    Object.assign(FLAGS, config);

    const hasName = fgWinfo.givenName || bgWinfos.find(winfo => winfo.givenName);
    $body.classList.toggle('nameless', !hasName);
    $body.classList.toggle('compact', FLAGS.compact_popup);

    Status.init(fgWinfo, bgWinfos);
    Omnibox.init();

    Row.addWindows(fgWinfo, bgWinfos);
    if (FLAGS.show_popup_stashed_items) {
        const folders = await Request.popupStashItems();
        if (!folders.length)
            return;
        Row.addFolders(folders);
        Row.toggleViewFolders();
    }
    Omnibox.respondIfFilled();
}

function initError() {
    Request.debug();
    Request.showWarningBadge();

    $currentWindowRow.hidden = true;
    $omnibox.hidden = true;
    $otherWindowsList.hidden = true;

    $status.textContent = 'Close and try again. If issue persists, restart Winger.';
    $toolbar.querySelectorAll('button').forEach($button => $button.remove());
    const $restartBtn = document.getElementById('restartTemplate').content.firstElementChild;
    $toolbar.appendChild($restartBtn);
    $restartBtn.onclick = () => browser.runtime.reload();
    $restartBtn.focus();
}

/**
 * Pressing Enter/Space on a button produces a `click` event by default; however the event does NOT capture modifiers. So we must do it ourselves:
 * For keypressed buttons, capture any modifiers in the `keydown` listener, then pass them to the action request within the subsequent `click` listener.
 */
const ButtonKeyPressModifier = {
    KEYS: ['Enter', ' '],
    modifiers: /** @type {string[]?} */ (null),
    /**
     * If Enter/Space key pressed on a button, store modifiers and return true (indicating that this is handled).
     * @param {KeyboardEvent} keyDownEvent
     * @returns {boolean}
     * @modifies this.modifiers
     */
    capture(keyDownEvent) {
        const isButtonPressed = isButton(keyDownEvent.target) && this.KEYS.includes(keyDownEvent.key);
        if (isButtonPressed)
            this.modifiers = Modifier.get(keyDownEvent);
        return isButtonPressed;
    },
    /**
     * Return and clear stored modifiers.
     * @returns {string[]?}
     * @modifies this.modifiers
     */
    release() {
        const modifiers = this.modifiers;
        this.modifiers = null;
        return modifiers;
    },
}

/**
 * @param {MouseEvent} event
 */
function onClick(event) {
    const { target } = event;
    if (target.id in Toolbar) {
        Toolbar[target.id]();
        return;
    }
    if (EditMode.isActive) {
        Status.update(event);
        return;
    }
    if (target === $currentWindowRow.$name) {
        EditMode.toggle();
        Status.update(event);
        return;
    }
    /** @type {HTMLElement} */
    const $action = target.closest('[data-action]');
    if ($action?.tabIndex === -1)
        return;
    if ($action?.dataset.action === 'togglePrivate') {
        $action.$row.classList.toggle('private');
        return;
    }
    // If `modifiers` is not null, this "click" is actually a key press on a button
    const modifiers = ButtonKeyPressModifier.release();
    Request.action({ event, $action, modifiers });
}

/**
 * @param {MouseEvent} event
 */
function onMouseDown(event) {
    if (EditMode.handleMouseDown(event.target))
        return;
}

/**
 * @param {MouseEvent} event
 */
function onContextMenu(event) {
    // Allow right-click only on non-readonly input
    if (event.target.matches('input:not([readonly])'))
        return;
    event.preventDefault();
}

/**
 * @param {KeyboardEvent} event
 */
function onKeyDown(event) {
    if (Omnibox.handleKeyDown(event))
        return;
    if (ButtonKeyPressModifier.capture(event))
        return;
    Navigation.handleKeyDown(event);
    Status.update(event);
}

/**
 * @param {KeyboardEvent} event
 */
function onKeyUp(event) {
    (() => {
        if (EditMode.handleKeyUp(event))
            return;
        if (Omnibox.handleKeyUp(event))
            return;
        if (Navigation.handleKeyUp(event))
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

/**
 * @param {InputEvent} event
 */
async function onInput(event) {
    if (await EditMode.handleInput(event.target))
        return;
    if (Omnibox.handleInput(event))
        return;
}

/**
 * @param {FocusEvent} event
 */
function onFocusIn(event) {
    const { target: $focused, relatedTarget: $defocused } = event;
    if (EditMode.handleFocusIn($focused, $defocused))
        return;
    if ($focused.tabIndex === -1)
        return $defocused?.focus?.();
    $focused?.select?.();
}
