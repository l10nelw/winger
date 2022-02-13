/* Tooltips on-hover over action elements */

import {
    getName,
    $actions,
} from './common.js';

const COLON = ': ';

//@ (Number), state -> state
export function init(tabCount) {
    let rowNames = new Map();

    //@ (Object) -> String
    function memoisedRowName($row) {
        let name = rowNames.get($row);
        if (!name) {
            name = getName($row);
            rowNames.set($row, name);
        }
        return name;
    }

    const tabCountPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
    const reopenPhrase = $row => $row.classList.contains('reopenTabs') ? '(reopen) ' : ''; //@ (Object) -> String

    for (const $action of $actions) {
        const $row = $action.$row || $action;
        const name = memoisedRowName($row);
        const insertText = reopenPhrase($row) + tabCountPhrase;
        $action.title = updateName($action.title, name).replace('#', insertText);
    }
}

// Add or change the name portion of a tooltip.
//@ (String, String) -> (String)
export function updateName(tooltip, name) {
    const colonIndex = tooltip.indexOf(COLON);
    if (colonIndex > -1)
        tooltip = tooltip.slice(0, colonIndex + COLON.length) + name;
    return tooltip;
}
