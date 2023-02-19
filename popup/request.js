/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

//@ -> (Promise: { Object, [Object], Number, Boolean })
export function popup() {
    return sendMessage({ type: 'popup' });
}

//@ -> state
export function help() {
    sendMessage({ type: 'help' });
}

// Gather action parameters from event and action element or action string. Proceed only if action found.
//@ (Object, String|Object) -> state|nil
export function action(event, action) {
    const request = { type: 'action' };
    if (typeof action === 'string') {
        request.action = action;
    } else {
        // action is an element
        const $row = action.$row || action;
        request.windowId = $row._id;
        request.action = action.dataset.action || $row.dataset.action;
    }
    if (!request.action)
        return;
    request.modifiers = getModifiers(event);
    sendMessage(request);
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