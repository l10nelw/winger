export const $omnibar = document.getElementById('omnibar');
$omnibar.addEventListener('keyup', onInput);


function onInput(event) {
    const str = $omnibar.value;
    const $firstMatchRow = filterRows(str);
    if (event.key == 'Enter' && $firstMatchRow) {
        window.goalAction(event, $firstMatchRow._id);
    }
}

// Hide rows whose names do not contain string. Returns first matching row or null.
export function filterRows(str) {
    const $rows = window.$rows;
    let $firstMatchRow;
    if (str) {
        for (const $row of $rows) {
            const isMatch = window.metaWindows[$row._id].displayName.includes(str);
            $row.hidden = !isMatch;
            $firstMatchRow = $firstMatchRow || (isMatch ? $row : null); // if not already found, it's this row
        }
    } else {
        for (const $row of $rows) {
            $row.hidden = false;
        }
        $firstMatchRow = $rows[0];
    }
    return $firstMatchRow;
}
