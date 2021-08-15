/* Send messages to the background frame */

import { $currentWindowRow, getActionAttr } from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

export function popup() {
    return sendMessage({ popup: true });
}

export function help() {
    return sendMessage({ help: true });
}

// Gather action parameters from event and $action element. Request only if action and windowId found.
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

export function setName(windowId, name) {
    return sendMessage({ setName: windowId, name });
}

export function stash(windowId = $currentWindowRow._id, close) {
    sendMessage({ stash: windowId, close });
    window.close();
}

export function debug() {
    sendMessage({ debug: true });
}