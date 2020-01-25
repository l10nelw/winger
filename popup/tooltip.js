import * as Status from './status.js';
import { end } from '../utils.js';

let tooltips;

export function generate(tabCount, hasReopenTab) {
    const tabPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
    const reopenTab_tooltips = hasReopenTab ? {
        '.reopenTab .bringBtn':   `Close and reopen ${tabPhrase} in (and switch to):`,
        '.reopenTab .sendBtn':    `Close and reopen ${tabPhrase} in:`,
    } : null;
    tooltips = {
        ...reopenTab_tooltips,
        '.bringBtn':              `Bring ${tabPhrase} to:`,
        '.sendBtn':               `Send ${tabPhrase} to:`,
        '.editModeRow .editBtn':  `Save and exit Edit Mode`,
        '.editBtn':               `Edit:`,
        '.otherRow':              `Switch to:`,
    };
}

export function show(event) {
    let $target = event.target;
    if (!$target.closest('.action')) {
        Status.show();
        return;
    }
    let selector = matchSelector($target);
    if (!selector) {
        selector = '.otherRow';
        $target = $target.closest(selector);
    }
    let tooltip = tooltips[selector];
    if (end(tooltip) == ':') tooltip += ` ${getName($target)}`;
    $target.title = tooltip;
    Status.show(tooltip);
}

function matchSelector($target) {
    for (const selector in tooltips) {
        if ($target.matches(selector)) return selector;
    }
}

function getName($target) {
    const $input = ($target.$row || $target).$input;
    return $input.value || $input.placeholder;
}
