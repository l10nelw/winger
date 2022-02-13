import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

const editCurrentWindow = () => EditMode.activate();
export const commands = {
    help:     Toolbar.help,
    settings: Toolbar.settings,
    options:  Toolbar.settings,
    edit:     editCurrentWindow,
    name:     editCurrentWindow,
    stash:    (event) => Request.stash(undefined, !event.shiftKey),
};

let commandReady;

const keyUpResponse = {

    Enter(event) {
        if (commandReady) {
            if (commandReady === 'debug') {
                Request.debug();
            } else {
                commands[commandReady](event);
            }
            clear();
        } else {
            const $firstRow = Filter.$shownRows?.[0];
            if ($firstRow) Request.action(event, $firstRow);
        }
    },

}

export function handleKeyUp(key, event) {
    if (key in keyUpResponse) keyUpResponse[key](event);
}

const isDeletion = event => event.inputType.startsWith('delete');

export function handleInput(event) {
    const str = $omnibox.value;
    const isSlashed = str.startsWith('/');

    $omnibox.classList.toggle('slashCommand', isSlashed);

    commandReady = isSlashed ? matchCommand(str) : null;
    if (commandReady && !isDeletion(event)) {
        autocompleteCommand(str, commandReady);
    }

    if (!isSlashed) Filter.execute(str);
}

function matchCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();
    for (const command in commands) {
        if (command.toUpperCase().startsWith(strUnslashed)) return command;
    }
    if (strUnslashed === 'DEBUG') return 'debug';
}

function autocompleteCommand(str, command) {
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length, command.length + 1);
}

export function clear() {
    $omnibox.value = $omnibox.placeholder = '';
    $omnibox.classList.remove('slashCommand');
    commandReady = null;
}
