/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import * as Modifier from '../modifier.js';
import { getValue } from '../storage.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').Winfo} Winfo */
/** @typedef {import('../types.js').BNode} Folder */
/** @typedef {import('../types.js').PopupInitMessage} PopupInitMessage */
/** @typedef {import('../types.js').ActionRequest} ActionRequest */
/** @typedef {import('./common.js').WindowRow$} WindowRow$ */


/** @type {(message: any) => Promise} */
const sendMessage = browser.runtime.sendMessage;

export const showWarningBadge = () => sendMessage({ type: 'warn' });
export const help = () => sendMessage({ type: 'help' });
export const debug = () => sendMessage({ type: 'debug' });

/**
 * @returns {Promise<PopupInitMessage>}
 */
export const popup = () => sendMessage({ type: 'popup' });

/**
 * @returns {Promise<Folder[]>}
 */
export const popupStash = () => sendMessage({ type: 'popupStash' });

/**
 * @param {Folder[]} folders
 * @returns {Promise<Folder[]>}
 */
export const popupStashContents = folders => sendMessage({ type: 'popupStashContents', folders });

/**
 * @param {WindowId} windowId
 * @param {string} name
 */
export const updateChrome = (windowId, name) => sendMessage({ type: 'update', windowId, name });

/**
 * Gather action parameters to create request. Proceed only if action string given via `command` or derived from `$action`.
 *
 * Args from slash-commands: `{ event, command, argument }`. Args from others: `{ event, $action }`.
 *
 * Request requirements based on action:
 * ```
 * { type: 'action', action: 'switch'|'bring',  windowId }
 * { type: 'action', action: 'send',  windowId|folderId, sendToMinimized|remove }  // folderId + 'send' -> stash tabs to folder
 * { type: 'action', action: 'new'|'pop'|'kick'|'newnormal'|'newprivate'|...,  argument }
 * { type: 'action', action: 'stash',  windowId|folderId, name, remove }  // folderId + 'stash' -> unstash folder
 * ```
 * @param {Object} info
 * @param {Event} info.event
 * @param {string} [info.command]
 * @param {string} [info.argument]
 * @param {HTMLElement} [info.$action]
 * @see ActionRequest
 */
export async function action({ event, command, argument, $action }) {
    /** @type {ActionRequest} */ const request = { type: 'action' };

    // Obtain `$row` and `request.action`
    /** @type {WindowRow$} */ let $row;
    if (command) {
        $row = event.target.closest('li') || $currentWindowRow;
        request.action = command;
        if (argument)
            request.argument = argument;
    } else
    if ($action) {
        $row = $action.$row || $action;
        request.action = $action.dataset.action || $row.dataset.action;
    }
    if (!request.action)
        return;

    const isStashAction = request.action === 'stash';
    const modifiers = Modifier.get(event);
    request.action = Modifier.modify(request.action, modifiers);

    // Disallow stashing a "tabless" window
    // Disallow sending/bringing to a "tabless" window via modifier-click on row
    // (action buttons should already be disabled)
    if ($row.matches('.tabless') && (isStashAction || modifiers.length))
        return;

    if ($row.matches('.stashed')) {
        // Only allow `stash` and `send` on stashed window
        if (!isStashAction && request.action !== 'send')
            return;
        request.folderId = $row._id;
        request.remove = !modifiers.includes(Modifier.STASHCOPY);
    } else {
        request.windowId = $row._id;
        if (isStashAction) {
            const $name = $row.$name;
            let name = $name.value;
            if (!name && await getValue('stash_nameless_with_title'))
                name = $name.placeholder;
            request.name = name;
            request.remove = !modifiers.includes(Modifier.STASHCOPY);
        } else {
            if (request.action === 'send' && $row.matches('.minimized'))
                request.sendToMinimized = true;
        }
    }

    sendMessage(request);
    window.close();
}
