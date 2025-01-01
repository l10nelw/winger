import {
    $otherWindowsList,
    $otherWindowRows,
} from './common.js';

export const $shownRows = []; // Visible other-rows

// Show only rows whose names contain str, and sort them by name length, shortest first.
//@ (String) -> state
export function execute(str) {
    str = str.trim();
    if (str)
        filter(str) && sort();
    else
        reset();
}

// Hide window-rows whose names do not contain str, case-insensitive. The rest are shown and given _nameLength property.
// Return count of shown rows.
//@ (String), state -> (Number), state
function filter(str) {
    str = str.toUpperCase();
    $shownRows.length = 0;
    for (const $row of $otherWindowRows) {
        const name = getNameOrTitle($row).toUpperCase();
        const isMatch = name.includes(str);
        $row.hidden = !isMatch;
        if (isMatch) {
            $row._nameLength = name.length;
            $shownRows.push($row);
        }
    }
    $otherWindowsList.classList.add('filtered');
    return $shownRows.length;
}

//@ (Object) -> (String)
function getNameOrTitle($row) {
    const $name = $row.$name;
    return $name.value || $name.placeholder;
}

// Sort shown rows by name length, shortest first.
//@ state -> state
function sort() {
    $shownRows.sort(($a, $b) => $a._nameLength - $b._nameLength);
    for (const $row of $shownRows)
        $otherWindowsList.appendChild($row);
}

// Revert all changes made by filter() and sort().
//@ state -> state
function reset() {
    // Restore sort order of 'live' $otherWindowsList.children by comparing against correctly-sorted $otherWindowRows.$withHeadings
    $otherWindowRows.$withHeadings.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow)
            $otherWindowsList.insertBefore($correctRow, $row); // Move correct row to incorrect row's location
    });
    $shownRows.length = 0;
    $shownRows.push(...$otherWindowRows);
    $otherWindowsList.classList.remove('filtered');
    $otherWindowsList.scroll(0, 0);
}