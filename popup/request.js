/* Send messages to the background frame */

import {
    $currentWindowRow,
    getActionAttr,
} from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

//@ -> (Promise: { Object, [Object], Number })
export function popup() {
    return sendMessage({ popup: true });
}

//@ -> state
export function help() {
    sendMessage({ help: true });
}

// Gather action parameters from event and $action element. Request only if action and windowId found.
//@ (Object, Object) -> state|nil
export function action(event, $action = event.target) {
    const $row = $action.$row || $action;
    const windowId = $row._id;
    if (!windowId) return;
    const action = getActionAttr($action) || getActionAttr($row);
    if (!action) return;
    sendMessage({
        action,
        windowId,
        modifiers: getModifiers(event),
    });
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
export function stash(windowId = $currentWindowRow._id, close) {
    sendMessage({ stash: windowId, close });
    window.close();
}

//@ -> state
export function debug() {
    sendMessage({ debug: true });
}