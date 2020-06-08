import { hasClass } from '../utils.js';
import * as Popup from './popup.js';

const colon = ': ';

export function init(tabCount) {
    let rowNames = new Map();

    function memoisedRowName($row) {
        let name = rowNames.get($row);
        if (!name) {
            name = Popup.getName($row);
            rowNames.set($row, name);
        }
        return name;
    }

    const tabCountPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
    const reopenPhrase = $row => hasClass('reopenTabs', $row) ? '(reopen) ' : '';

    for (const $action of Popup.getActionElements()) {
        const $row = $action.$row || $action;
        const name = memoisedRowName($row);
        const insertText = reopenPhrase($row) + tabCountPhrase;
        $action.title = updateName($action.title, name).replace('#', insertText);
    }
}

// Add or change the name portion of a tooltip.
export function updateName(tooltip, name) {
    const colonIndex = tooltip.indexOf(colon);
    if (colonIndex > -1) {
        tooltip = tooltip.slice(0, colonIndex + colon.length) + name;
    }
    return tooltip;
}
