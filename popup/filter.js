import {
    $body,
    $otherWindowsList,
    $otherWindowRows,
} from './common.js';

/** @import { WindowRow$ } from './common.js' */

/**
 * Visible other-window rows.
 * @type {WindowRow$[]}
 */
export const $shownRows = [];

/**
 * Show only rows whose names contain str, and sort them by name length, shortest first.
 * @param {string} str
 */
export function execute(str) {
    str = str.trim();
    if (str)
        (filter(str) > 1) && sortShown();
    else
        reset();
}

/**
 * Hide window rows whose names do not contain `str`, case-insensitive. The rest are shown and given `_nameLength` property.
 * @param {string} str
 * @returns {number} Count of shown rows
 */
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
    $body.classList.add('filtered');
    return $shownRows.length;
}

/**
 * @param {WindowRow$} $row
 * @returns {string}
 */
function getNameOrTitle($row) {
    const $name = $row.$name;
    return $name.value || $name.placeholder;
}

/** Sort shown rows by name length, shortest first. */
function sortShown() {
    $shownRows.sort(($a, $b) => $a._nameLength - $b._nameLength);
    for (const $row of $shownRows)
        $otherWindowsList.appendChild($row);
}

/** Show all rows in the correct order. */
function reset() {
    if (!$body.classList.contains('filtered'))
        return;
    // Restore sort order of 'live' `$otherWindowsList.children` by comparing against correctly-sorted `$otherWindowRows.$withHeadings`
    $otherWindowRows.$withHeadings.forEach(($correctRow, index) => {
        $correctRow.hidden = false;
        const $row = $otherWindowsList.children[index];
        if ($row !== $correctRow)
            $otherWindowsList.insertBefore($correctRow, $row); // Move correct row to incorrect row's location
    });
    $shownRows.length = 0;
    $shownRows.push(...$otherWindowRows);
    $body.classList.remove('filtered');
    $otherWindowsList.scroll(0, 0);
}