import { $currentWindowRow, $otherWindowsList, $otherWindowRows, getName, requestAction } from './popup.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import { getScrollbarWidth, hasClass, addClass, removeClass, toggleClass } from '../utils.js';

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
    const isSlashed = str[0] === '/';
    toggleClass('slashCommand', $omnibox, isSlashed);
    if (isSlashed) {
        let command;
        if (!nonCompletingKeys.includes(key)) {
            command = completeCommand(str);
        }
        if (enter) {
            clear();
            if (command) commands[command]();
        }
    } else {
        showFilteredRows(str);
        const $firstRow = [...$otherWindowsList.children].find($row => !$row.hidden);
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

// Show only rows whose names contain str, and sort them by name length, shortest first.
function showFilteredRows(str) {
    if (!str) return showAllRows();

    // Show/hide rows and add name-length values to them
    const $filteredRows = filterRows(str);
    if (!$filteredRows.length) return;

    // Sort filtered rows and move them to the end of the list
    $filteredRows.sort(($a, $b) => $a._nameLength - $b._nameLength);
    $filteredRows.forEach($row => $otherWindowsList.appendChild($row));

    // Add offset if scrollbar disappears
    if (hasClass('scrollbarOffset', $currentWindowRow) && !getScrollbarWidth($otherWindowsList)) {
        addClass('scrollbarOffset', $otherWindowsList);
    }
}

// Hide rows whose names do not contain str, case-insensitive.
// The rest are shown, given name-length expandos and returned as an array.
function filterRows(str) {
    str = str.toUpperCase();
    const $filteredRows = [];
    for (const $row of $otherWindowRows) {
        const name = getName($row).toUpperCase();
        const isMatch = name.includes(str);
        $row.hidden = !isMatch;
        if (isMatch) {
            $row._nameLength = name.length;
            $filteredRows.push($row);
        }
    }
    return $filteredRows;
}

// Reverse all changes by showFilteredRows(): hidden rows, sort order, scrollbar offset.
// Restore sort order by comparing 'live' $otherWindowsList.children against correctly sorted $otherWindowRows.
export function showAllRows() {
    $otherWindowRows.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow) {
            $otherWindowsList.insertBefore($correctRow, $row);
        }
    });
    removeClass('scrollbarOffset', $otherWindowsList);
}

export function clear() {
    $omnibox.value = omnibox.placeholder = '';
    removeClass('slashCommand', $omnibox);
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