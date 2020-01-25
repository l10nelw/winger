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

export function show($element) {
    if (!$element.closest('.action')) {
        Status.show();
        return;
    }
    let selector = matchSelector($element);
    if (!selector) {
        selector = '.otherRow';
        $element = $element.closest(selector);
    }
    let tooltip = tooltips[selector];
    if (end(tooltip) == ':') tooltip += ` ${getName($element)}`;
    $element.title = tooltip;
    Status.show(tooltip);
}

function matchSelector($element) {
    for (const selector in tooltips) {
        if ($element.matches(selector)) return selector;
    }
}

function getName($element) {
    const $input = ($element.$row || $element).$input;
    return $input.value || $input.placeholder;
}
