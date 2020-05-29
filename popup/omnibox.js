import { $otherWindowsList, $otherWindowRows, getDisplayName, requestAction } from './popup.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';

export const $omnibox = document.getElementById('omnibox');

const nonCompletingKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
const commands = {
    help:     Toolbar.help,
    settings: Toolbar.settings,
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
        filterRows(str);
        const $firstRow = $otherWindowRows.find($row => !$row.hidden);
        if (enter && $firstRow) requestAction(event, $firstRow);
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

// Hide rows whose names do not contain str, case-insensitive. Shown rows are sorted by name length, shortest first.
function filterRows(str) {
    if (!str) return showAllRows();
    str = str.toUpperCase();
    let $filteredRows = [];
    for (const $row of $otherWindowRows) {
        const name = getDisplayName($row).toUpperCase();
        const isMatch = name.includes(str);
        $row.hidden = !isMatch;
        if (isMatch) {
            $row._nameLength = name.length;
            $filteredRows.push($row);
        }
    }
    // Sort filtered rows and move them to the end of the list
    $filteredRows.sort(($a, $b) => $a._nameLength - $b._nameLength);
    for (const $row of $filteredRows) {
        $otherWindowsList.appendChild($row);
    }
}

// Restore hidden rows and original sort order.
// Compare 'live' $otherWindowsList.children against correctly sorted $otherWindowRows.
export function showAllRows() {
    $otherWindowRows.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow) {
            $otherWindowsList.insertBefore($correctRow, $row);
        }
    });
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