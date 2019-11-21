import * as EditMode from './editmode.js';

export const $omnibar = document.getElementById('omnibar');
const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight'];
const commands = {
    help() {
        browser.tabs.create({ url: '/help/help.html' });
        window.close();
    },
    edit() {
        EditMode.$toggler.checked = true;
        EditMode.onToggle();
    },
};

$omnibar.value = '';
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
            window.goalAction(event, $firstMatchRow._id);
        }
    }
}

// Autocomplete a command based on str. Returns command, or undefined if none found.
function completeCommand(str) {
    const strUnslashed = str.slice(1);
    for (const command in commands) {
        if (command.startsWith(strUnslashed)) {
            $omnibar.value = `/${command}`;
            $omnibar.setSelectionRange(str.length, command.length + 1);
            return command;
        }
    }
}

// Hide rows whose names do not contain str. Returns first matching row or null.
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
