import {
    $otherWindowsList,
    $otherWindowRows,
    getName,
} from './common.js';

export let $shownRows;

//@ state -> state
export function init() {
    $shownRows = [...$otherWindowRows];
}

// Show only rows whose names contain str, and sort them by name length, shortest first.
//@ (String) -> state
export function execute(str) {
    str = str.trim();
    if (!str) {
        $shownRows = reset();
        return;
    }

    $shownRows = filter(str); // Show/hide rows and add _nameLength property to shown rows
    if (!$shownRows.length)
        return;

    $shownRows.sort(compareNameLength);
    for (const $row of $shownRows)
        $otherWindowsList.appendChild($row); // Move filtered row to the end of the list
}

const compareNameLength = ($a, $b) => $a._nameLength - $b._nameLength; //@ (Object, Object) -> (Number)

// Hide rows whose names do not contain str, case-insensitive.
// The rest are shown, given _nameLength property and returned as an array.
//@ (String), state -> ([Object]), state
function filter(str) {
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

// Reverse all changes made by execute(): hidden rows, sort order.
// Restore sort order by comparing 'live' $otherWindowsList.children against correctly-sorted $otherWindowRows.
//@ state -> state
function reset() {
    $otherWindowRows.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow)
            $otherWindowsList.insertBefore($correctRow, $row);
    });
    return $otherWindowRows;
}