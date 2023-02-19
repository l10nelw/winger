import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

const COMMAND_TO_CALLBACK = {
    help:        Toolbar.help,
    settings:    Toolbar.settings,
    edit:        () => EditMode.toggle(),
    new:         event => Request.action(event, 'new'),
    newprivate:  event => Request.action(event, 'newprivate'),
    pop:         event => Request.action(event, 'pop'),
    popprivate:  event => Request.action(event, 'popprivate'),
    kick:        event => Request.action(event, 'kick'),
    kickprivate: event => Request.action(event, 'kickprivate'),
    stash:       event => Request.stash(!event.shiftKey),
};
const ALIAS_TO_COMMAND = {
    options: 'settings',
    name: 'edit',
};
const SHORTHAND_TO_COMMAND = {
    np: 'newprivate',
    pp: 'popprivate',
    kp: 'kickprivate',
};

export let matchedCommand;

//@ (Boolean) -> state
export function init(SETTINGS) {
    if (!SETTINGS.enable_stash)
        delete COMMAND_TO_CALLBACK.stash;
}

//@ (String, Object), state -> state
export function handleKeyUp(event) {
    if (event.key === 'Enter')
        handleEnter(event);
}

//@ (Object), state -> state
function handleEnter(event) {
    if (matchedCommand === 'debug') {
        Request.debug();
        clear();
        return;
    }
    if (matchedCommand) {
        const callback = COMMAND_TO_CALLBACK[matchedCommand] || COMMAND_TO_CALLBACK[ALIAS_TO_COMMAND[matchedCommand]];
        callback?.(event);
        clear();
        return;
    }
    if ($omnibox.value.startsWith('/')) {
        clear();
        return;
    }
    if (!EditMode.isActive) {
        const $firstRow = Filter.$shownRows?.[0];
        if ($firstRow)
            Request.action(event, $firstRow);
    }
}

//@ (Object), state -> state
export function handleInput(event) {
    const str = $omnibox.value;
    const isSlashed = str.startsWith('/');

    $omnibox.classList.toggle('slashCommand', isSlashed);

    if (isSlashed) {
        let isShorthand;
        [matchedCommand, isShorthand] = matchCommand(str);
        if (matchedCommand && !isDeletion(event))
            isShorthand ? expandShorthand(matchedCommand) : autocompleteCommand(str, matchedCommand);
    } else {
        Filter.execute(str);
    }
}

//@ (Object) -> (Boolean)
const isDeletion = event => event.inputType.startsWith('delete');

//@ (String) -> ([String, Boolean])
function matchCommand(str) {
    const strUnslashed = str.slice(1).toUpperCase();

    if (strUnslashed === 'DEBUG')
        return ['debug', false];

    for (const command in COMMAND_TO_CALLBACK)
        if (command.toUpperCase().startsWith(strUnslashed))
            return [command, false];

    for (const alias in ALIAS_TO_COMMAND)
        if (alias.toUpperCase().startsWith(strUnslashed))
            return [alias, false];

    for (const shorthand in SHORTHAND_TO_COMMAND)
        if (shorthand.toUpperCase() === strUnslashed)
            return [SHORTHAND_TO_COMMAND[shorthand], true];

    return [null, false];
}

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length, command.length + 1);
}

//@ (String) -> state
function expandShorthand(command) {
    $omnibox.value = `/${command}`;
    $omnibox.select();
}

//@ -> state
export function clear() {
    $omnibox.value = $omnibox.placeholder = '';
    $omnibox.classList.remove('slashCommand');
    matchedCommand = null;
}
