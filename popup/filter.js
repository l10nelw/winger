import { $currentWindowRow, $otherWindowsList, $otherWindowRows, getName, getScrollbarWidth } from './common.js';

export let $shownRows;

export function init() {
    $shownRows = $otherWindowRows;
}

// Show only rows whose names contain str, and sort them by name length, shortest first.
export function execute(str) {
    if (!str) {
        $shownRows = reset();
        return;
    }

    $shownRows = filter(str); // Show/hide rows and add _nameLength property to shown rows
    if (!$shownRows.length) return;

    $shownRows.sort(compareNameLength);
    $shownRows.forEach(($row, index) => {
        $otherWindowsList.appendChild($row); // Move filtered row to the end of the list
        $row._index = index;
    });

    // Add offset if scrollbar disappears
    if ($currentWindowRow.classList.contains('scrollbarOffset') && !getScrollbarWidth($otherWindowsList))
        $otherWindowsList.classList.add('scrollbarOffset');
}

const compareNameLength = ($a, $b) => $a._nameLength - $b._nameLength;

// Hide rows whose names do not contain str, case-insensitive.
// The rest are shown, given _nameLength property and returned as an array.
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

// Reverse all changes made by execute(): hidden rows, sort order, _index, scrollbar offset.
// Restore sort order by comparing 'live' $otherWindowsList.children against correctly-sorted $otherWindowRows.
function reset() {
    $otherWindowRows.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        $correctRow._index = index;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow) {
            $otherWindowsList.insertBefore($correctRow, $row);
            $row._index = index;
        }
    });
    $otherWindowsList.classList.remove('scrollbarOffset');
    return $otherWindowRows;
}