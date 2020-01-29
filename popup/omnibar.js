import * as Popup from './popup.js';
import * as EditMode from './editmode.js';

const $omnibar = document.getElementById('omnibar');
const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
const commands = {
    help:    _ => Popup.help(),
    options: _ => Popup.options(),
    edit:    _ => EditMode.activate(),
};

$omnibar.addEventListener('keyup', onInput);


function onInput(event) {
    const str = $omnibar.value;
    const key = event.key;
    const enter = key === 'Enter';
    if (str[0] === '/') {
        let command;
        if (str.length > 1 && !controlKeys.includes(key)) {
            command = completeCommand(str);
        }
        if (enter) {
            $omnibar.value = '';
            if (command) commands[command]();
        }
    } else {
        const $firstMatchRow = filterRows(str);
        if (enter && $firstMatchRow) {
            Popup.callGoalAction(event, $firstMatchRow._id);
        }
    }
}

// Autocomplete a command based on str, case-insensitive. Returns command, or undefined if no command found.
function completeCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();
    for (const command in commands) {
        if (command.toUpperCase().startsWith(strUnslashed)) {
            $omnibar.value = `/${command}`;
            $omnibar.setSelectionRange(str.length, command.length + 1);
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
            const isMatch = Popup.rowName($row).toUpperCase().includes(str);
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
    $omnibar.placeholder = str;
}

export function disable(yes) {
    $omnibar.disabled = yes;
}

export function focus() {
    $omnibar.focus();
}