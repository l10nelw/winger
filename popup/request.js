/* Send messages to the background frame */

import { $currentWindowRow } from './common.js';
import * as Modifier from '../modifier.js';
import { getValue } from '../storage.js';

/** @import { WindowRow$ } from './common.js' */
/** @import { WindowId, BNode, PopupInitMessage, ActionRequest } from '../types.js' */

/** @returns {Promise<void>} */ export const showWarningBadge = () => browser.runtime.sendMessage({ type: 'warn' });
/** @returns {Promise<void>} */ export const help = () => browser.runtime.sendMessage({ type: 'help' });
/** @returns {Promise<void>} */ export const debug = () => browser.runtime.sendMessage({ type: 'debug' });

/** @returns {Promise<PopupInitMessage>} */ export const popup = () => browser.runtime.sendMessage({ type: 'popup' });
/** @returns {Promise<BNode[]>} */ export const popupStashedItems = () => browser.runtime.sendMessage({ type: 'popupStashedItems' });

/**
 * @param {BNode[]} folders
 * @returns {Promise<BNode[]>}
 */
export const popupStashedSizes = folders => browser.runtime.sendMessage({ type: 'popupStashedSizes', folders });

/**
 * @param {WindowId} windowId
 * @param {string} name
 * @returns {Promise<void>}
 */
export const updateChrome = (windowId, name) => browser.runtime.sendMessage({ type: 'update', windowId, name });

/**
 * Gather action parameters to create an ActionRequest. Proceed only if action string is given via `command` or derived from `$action`.
 *
 * Args from slash-commands: `{ event, command, argument }`.
 * Args from others: `{ event, $action }`.
 *
 * Request requirements based on action:
 * ```
 * { type: 'action', action: 'switch'|'bring',  windowId }
 * { type: 'action', action: 'send',  windowId|folderId, sendToMinimized|remove }  // folderId + 'send' -> stash tabs to folder
 * { type: 'action', action: 'new'|'pop'|'kick'|'newnormal'|'newprivate'|...,  argument }
 * { type: 'action', action: 'stash',  windowId|folderId, name, remove }  // folderId + 'stash' -> unstash folder
 * ```
 * @see ActionRequest
 * @param {Object} info
 * @param {Event} info.event
 * @param {string} [info.command]
 * @param {string} [info.argument]
 * @param {HTMLElement} [info.$action]
 * @returns {Promise<void>}
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

    browser.runtime.sendMessage(request);
    window.close();
}
