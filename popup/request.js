/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import { get as getModifiers } from '../modifier.js';

const sendMessage = browser.runtime.sendMessage;

//@ -> (Promise: Object)
export const popup = () => sendMessage({ type: 'popup' });
//@ (Number, String) -> state
export const updateChrome = (windowId, name) => sendMessage({ type: 'update', windowId, name });
//@ -> state
export const showWarningBadge = () => sendMessage({ type: 'warn' });
export const help = () => sendMessage({ type: 'help' });
export const debug = () => sendMessage({ type: 'debug' });

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
        request.minimized = $row.matches('.minimized');
        request.action = $action.dataset.action || $row.dataset.action;
    }
    if (!request.action)
        return;
    request.argument = argument;
    request.modifiers = getModifiers(event);
    sendMessage(request); // request = { type: 'action', action, argument, minimized, modifiers, windowId }
    window.close();
}

//@ (Number, Boolean) -> state
export function stash(close, windowId = $currentWindowRow._id) {
    sendMessage({ type: 'stash', windowId, close });
    window.close();
}
