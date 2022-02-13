import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

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

let commandReady;

//@ (Object), state -> state
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

//@ (String, Object), state -> state
export function handleKeyUp(key, event) {
    if (key in keyUpResponse) keyUpResponse[key](event);
}

const isDeletion = event => event.inputType.startsWith('delete'); //@ (Object) -> (Boolean)

//@ (Object), state -> state
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

//@ (String) -> (String)
function matchCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();
    for (const command in commands) {
        if (command.toUpperCase().startsWith(strUnslashed)) return command;
    }
    if (strUnslashed === 'DEBUG') return 'debug';
}

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length, command.length + 1);
}

//@ -> state
export function clear() {
    $omnibox.value = $omnibox.placeholder = '';
    $omnibox.classList.remove('slashCommand');
    commandReady = null;
}
