/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

//@ -> (Promise: Object)
export function popup() {
    return sendMessage({ type: 'popup' });
}

//@ -> state
export function help() {
    sendMessage({ type: 'help' });
}

// Gather action parameters to create request. Proceed only if action string given via `command` or derived from `$action`.
//@ (Object) -> state|nil
export function action({ event, $action, command, argument }) {
    const request = { type: 'action' };
    if (command) {
        request.action = command;
    } else
    if ($action) {
        const $row = $action.$row || $action;
        if ($row.matches('.tabless') && (event.ctrlKey || event.shiftKey))
            return; // Do not allow send/bring to a "tabless" window
        request.windowId = $row._id;
        request.action = $action.dataset.action || $row.dataset.action;
    }
    if (!request.action)
        return;
    request.argument = argument;
    request.modifiers = getModifiers(event);
    sendMessage(request); // { type: 'action', action, argument, modifiers, windowId }
    window.close();
}

//@ (Number, String) -> state
export function updateChrome(windowId, name) {
    sendMessage({ type: 'update', windowId, name });
}

//@ (Number, Boolean) -> state
export function stash(close, windowId = $currentWindowRow._id) {
    sendMessage({ type: 'stash', windowId, close });
    window.close();
}

//@ -> state
export function debug() {
    sendMessage({ type: 'debug' });
}