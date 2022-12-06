/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

//@ -> (Promise: { Object, [Object], Number, Boolean })
export function popup() {
    return sendMessage({ popup: true });
}

//@ -> state
export function help() {
    sendMessage({ help: true });
}

// Gather action parameters from event and action element or action string. Proceed only if action found.
//@ (Object, String|Object) -> state|nil
export function action(event, action) {
    const request = {};
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

//@ (Number, String) -> (Promise: Boolean)
export function checkName(windowId, name) {
    return sendMessage({ checkName: windowId, name });
}

//@ (Number, String) -> state
export function setName(windowId, name) {
    sendMessage({ setName: windowId, name });
}

//@ (Number, Boolean) -> state
export function stash(close, windowId = $currentWindowRow._id) {
    sendMessage({ stash: windowId, close });
    window.close();
}

//@ -> state
export function debug() {
    sendMessage({ debug: true });
}