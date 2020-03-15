import * as Popup from './popup.js';
import * as EditMode from './editmode.js';

export const $omnibox = document.getElementById('omnibox');
const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
const commands = {
    help:     Popup.openHelp,
    settings: Popup.openSettings,
    edit:     EditMode.activate,
};

export function onKeyUp(event) {
    const str = $omnibox.value;
    const key = event.key;
    const enter = key === 'Enter';
    if (str[0] === '/') {
        let command;
        if (!controlKeys.includes(key)) {
            command = completeCommand(str);
        }
        if (enter) {
            if (command) commands[command]();
            $omnibox.value = '';
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
    for (const $row of Popup.$otherWindowRows) {
        $row.hidden = false;
    }
}

export function info(str = '') {
    $omnibox.placeholder = str;
}

export function disable(yes) {
    $omnibox.disabled = yes;
}

export function focus() {
    $omnibox.focus();
}