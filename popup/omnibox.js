import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';
import { BRING, SEND } from '../modifier.js';

const editCurrentWindow = () => EditMode.toggle();
const commands = {
    help:        Toolbar.help,
    settings:    Toolbar.settings,
    options:     Toolbar.settings,
    new:         (event) => Request.action(event, 'new'),
    newprivate:  (event) => Request.action(event, 'newprivate'),
    pop:         (event) => Request.action(event, 'pop'),
    popprivate:  (event) => Request.action(event, 'popprivate'),
    kick:        (event) => Request.action(event, 'kick'),
    kickprivate: (event) => Request.action(event, 'kickprivate'),
    stash:       (event) => Request.stash(undefined, !event.shiftKey),
    edit:        editCurrentWindow,
    name:        editCurrentWindow,
};

let commandReady; // The current autocompleted command

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
            if ($firstRow)
                Request.action(event, $firstRow);
        }
    },
}

// Hint is shown if key matches; cleared by events handled in popup.js
const modifierHint = {
    //@ (Number) -> state
    init(selectedTabCount) {
        const tabWord = selectedTabCount === 1 ? 'tab' : 'tabs';
        this[BRING] = `[${BRING}] Bring ${tabWord} to...`;
        this[SEND] = `[${SEND}] Send ${tabWord} to...`;
    },
    //@ (String) -> (String), state | (undefined)
    match(key) {
        if ($omnibox.value)
            return; // Placeholder not visible anyway
        if (key === 'Control')
            key = 'Ctrl';
        const hint = this[key];
        if (hint)
            $omnibox.placeholder = hint;
        return hint;
    },
}

//@ (Number, Boolean) -> state
export function init(selectedTabCount, stashEnabled) {
    modifierHint.init(selectedTabCount);
    if (!stashEnabled)
        delete commands.stash;
}

//@ (String), state -> state
export function handleKeyDown(key) {
    return modifierHint.match(key);
}

//@ (String, Object), state -> state
export function handleKeyUp(key, event) {
    if (key in keyUpResponse)
        keyUpResponse[key](event);
}

const isDeletion = event => event.inputType.startsWith('delete'); //@ (Object) -> (Boolean)

//@ (Object), state -> state
export function handleInput(event) {
    const str = $omnibox.value;
    const isSlashed = str.startsWith('/');

    $omnibox.classList.toggle('slashCommand', isSlashed);

    commandReady = isSlashed ? matchCommand(str) : null;
    if (commandReady && !isDeletion(event))
        autocompleteCommand(str, commandReady);

    if (!isSlashed)
        Filter.execute(str);
}

//@ (String) -> (String)
function matchCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();
    for (const command in commands)
        if (command.toUpperCase().startsWith(strUnslashed))
            return command;
    if (strUnslashed === 'DEBUG')
        return 'debug';
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
