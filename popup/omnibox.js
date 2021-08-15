import { removeClass, toggleClass } from '../utils.js';
import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

const NON_COMPLETING_KEYS = new Set(['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Control', 'Shift', 'Alt']);

const editCurrentWindow = () => EditMode.activate();

export const commands = {
    help:       Toolbar.help,
    settings:   Toolbar.settings,
    options:    Toolbar.settings,
    edit:       editCurrentWindow,
    name:       editCurrentWindow,
    pop:        () => Request.pop(),
    popprivate: () => Request.pop(true),
    stash:      (event) => Request.stash(undefined, !event.shiftKey),
};

export function handleKeyUp(key, event) {
    const enter = key === 'Enter' && $omnibox._enter;
    if (enter) $omnibox._enter = false;
    const str = $omnibox.value;

    const isSlashed = str.startsWith('/');
    toggleClass('slashCommand', $omnibox, isSlashed);
    if (isSlashed) return handleSlashed(key, event, str, enter);

    Filter.execute(str);
    const $firstRow = Filter.$shownRows?.[0];
    if (enter && $firstRow) Request.action(event, $firstRow);
}

function handleSlashed(key, event, str, enter) {
    let command;
    if (!( NON_COMPLETING_KEYS.has(key) || event.ctrlKey || event.altKey )) {
        command = completeCommand(str);
    }
    if (enter) {
        clear();
        if (handleDebugCommand(str)) return;
        if (command) commands[command](event);
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

function handleDebugCommand(str) {
    if (str.trim().toUpperCase() === '/DEBUG') {
        placeholder('Debug mode on in console');
        Request.debug();
        return true;
    }
}

export function clear() {
    $omnibox.value = $omnibox.placeholder = '';
    removeClass('slashCommand', $omnibox);
}
