import * as Popup from './popup.js';
import * as EditMode from './editmode.js';

export const $omnibox = document.getElementById('omnibox');

const nonCompletingKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
const commands = {
    help:     Popup.help,
    settings: Popup.settings,
    edit:     EditMode.activate,
};

export function handleKeyUp(key, event) {
    const enter = key === 'Enter' && $omnibox._enter;
    if (enter) $omnibox._enter = false;
    const str = $omnibox.value;
    if (str[0] === '/') {
        // Handle slash command
        let command;
        if (!nonCompletingKeys.includes(key)) {
            command = completeCommand(str);
        }
        if (enter) {
            $omnibox.value = '';
            if (command) commands[command]();
        }
    } else {
        const $firstMatchRow = filterRows(str);
        if (enter && $firstMatchRow) {
            Popup.requestAction(event, $firstMatchRow);
        }
    }
}

// Autocomplete a command based on str, case-insensitive. Returns command, or undefined if no command found.
function completeCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();
    for (const command in commands) {
        if (command.toUpperCase().startsWith(strUnslashed)) {
            $omnibox.value = `/${command}`;
            $omnibox.setSelectionRange(str.length, command.length + 1);
            return command;
        }
    }
}

// Hide rows whose names do not contain str, case-insensitive. Returns first matching row or null.
function filterRows(str) {
    let $firstMatchRow;
    if (str) {
        str = str.toUpperCase();
        for (const $row of Popup.$otherWindowRows) {
            const isMatch = Popup.getDisplayName($row).toUpperCase().includes(str);
            $row.hidden = !isMatch;
            $firstMatchRow = $firstMatchRow || (isMatch ? $row : null); // if not already found, it's this row
        }
    } else {
        showAllRows();
        $firstMatchRow = Popup.$otherWindowRows[0];
    }
    return $firstMatchRow;
}

export function showAllRows() {
    Popup.$otherWindowRows.forEach($row => $row.hidden = false);
}

export function info(str = '') {
    $omnibox.placeholder = str;
    return str;
}

export function disable(yes) {
    $omnibox.disabled = yes;
}

export function focus() {
    $omnibox.focus();
}