import { hasClass, getModifiers, end } from '../utils.js';
import * as Popup from './popup.js';
import * as Status from './status.js';

let bringModifier, sendModifier, EditTooltips, Tooltips, $lastTarget;

export function generate(tabCount, hasReopenTab) {
    bringModifier = Popup.OPTIONS.bring_modifier;
    sendModifier = Popup.OPTIONS.send_modifier;
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
            text: `Bring (close and reopen) ${tabPhrase} to:`,
            match: ($target, $otherRow, doBringTab, doSendTab) =>
                hasClass('reopenTab', $otherRow) && (doBringTab || !doSendTab && hasClass('bringBtn', $target)),
        },
        sendReopenTab: {
            text: `Send (close and reopen) ${tabPhrase} to:`,
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

// Show tooltip based on event.
// A modifer array may be passed instead of event to toggle relevant modifier text in the tooltip.
export function show(event) {
    let modifiers;
    let $target = event.target;
    if ($target) {
        // event passed
        if (!$target.closest('.action')) return Status.show();
        $lastTarget = $target;
    } else {
        // array passed
        $target = $lastTarget;
        modifiers = event;
    }
    let text = matchTooltip(EditTooltips, $target, $target.$row);
    if (!text) {
        modifiers = modifiers || getModifiers(event);
        const $otherRow = $target.closest('.otherRow');
        const doBringTab = modifiers.includes(bringModifier);
        const doSendTab  = modifiers.includes(sendModifier);
        text = matchTooltip(Tooltips, $target, $otherRow, doBringTab, doSendTab);
        const modifierText = doBringTab ? `[${bringModifier}] ` : doSendTab ? `[${sendModifier}] ` : ``;
        text = modifierText + text;
    }
    if (end(text) == ':') text += ` ${getName($target)}`;
    Status.show(text);
}

function matchTooltip(tooltipDict, ...args) {
    for (const action in tooltipDict) {
        const tooltip = tooltipDict[action];
        if (tooltip.match(...args)) return tooltip.text;
    }
}

function getName($target) {
    const $input = ($target.$row || $target).$input;
    return $input.value || $input.placeholder;
}
