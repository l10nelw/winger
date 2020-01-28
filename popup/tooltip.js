import { hasClass, getModifiers, end } from '../utils.js';
import * as Popup from './popup.js';
import * as Status from './status.js';

let EditTooltips, Tooltips;

export function generate(tabCount, hasReopenTab) {
    const tabPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;

    EditTooltips = {
        doneEdit: {
            text: `Save and exit Edit Mode`,
            match: ($target, $row) => hasClass('editModeRow', $row) && hasClass('editBtn', $target),
        },
        edit: {
            text: `Edit:`,
            match: ($target) => hasClass('editBtn', $target),
        },
    };

    const ReopenTooltips = hasReopenTab ? {
        bringReopenTab: {
            text: `Close and reopen ${tabPhrase} in (and switch to):`,
            match: ($target, $otherRow, doBringTab, doSendTab) =>
                hasClass('reopenTab', $otherRow) && (doBringTab || !doSendTab && hasClass('bringBtn', $target)),
        },
        sendReopenTab: {
            text: `Close and reopen ${tabPhrase} in:`,
            match: ($target, $otherRow, _, doSendTab) =>
                hasClass('reopenTab', $otherRow) && (doSendTab || hasClass('sendBtn', $target)),
        },
    } : null;

    Tooltips = {
        ...ReopenTooltips,
        bringTab: {
            text: `Bring ${tabPhrase} to:`,
            match: ($target, $otherRow, doBringTab, doSendTab) =>
                doBringTab && $otherRow || !doSendTab && hasClass('bringBtn', $target),
        },
        sendTab: {
            text: `Send ${tabPhrase} to:`,
            match: ($target, $otherRow, _, doSendTab) => doSendTab && $otherRow || hasClass('sendBtn', $target),
        },
        switch: {
            text: `Switch to:`,
            match: (_, $otherRow) => $otherRow,
        }
    };
}

export function show(event) {
    let $target = event.target;
    if (!$target.closest('.action')) return Status.show();
    let text = matchTooltip(EditTooltips, $target, $target.$row);
    if (!text) {
        const $otherRow = $target.closest('.otherRow');
        const modifiers = getModifiers(event);
        const doBringTab = modifiers.includes(Popup.OPTIONS.bring_modifier);
        const doSendTab  = modifiers.includes(Popup.OPTIONS.send_modifier);
        text = matchTooltip(Tooltips, $target, $otherRow, doBringTab, doSendTab);
        const modifierText =
            doBringTab ? `[${Popup.OPTIONS.bring_modifier}] ` :
            doSendTab ? `[${Popup.OPTIONS.send_modifier}] ` : ``;
        text = modifierText + text;
    }
    if (end(text) == ':') text += ` ${getName($target)}`;
    $target.title = text;
    Status.show(text);
}

function matchTooltip(tooltips, ...args) {
    for (const action in tooltips) {
        const tooltip = tooltips[action];
        if (tooltip.match(...args)) return tooltip.text;
    }
}

function getName($target) {
    const $input = ($target.$row || $target).$input;
    return $input.value || $input.placeholder;
}
