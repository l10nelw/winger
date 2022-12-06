import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';
import { BRING, SEND } from '../modifier.js';

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
const SHORTFORM_TO_COMMAND = {
    np: 'newprivate',
    pp: 'popprivate',
    kp: 'kickprivate',
};

let matchedCommand;

//@ (Object), state -> state
const KEYUP_RESPONSE = {
    Enter(event) {
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
        const $firstRow = Filter.$shownRows?.[0];
        if ($firstRow)
            Request.action(event, $firstRow);
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
        delete COMMAND_TO_CALLBACK.stash;
}

//@ (String), state -> state
export function handleKeyDown(key) {
    return modifierHint.match(key);
}

//@ (String, Object), state -> state
export function handleKeyUp(key, event) {
    KEYUP_RESPONSE[key]?.(event);
}

const isDeletion = event => event.inputType.startsWith('delete'); //@ (Object) -> (Boolean)

//@ (Object), state -> state
export function handleInput(event) {
    const str = $omnibox.value;
    const isSlashed = str.startsWith('/');

    $omnibox.classList.toggle('slashCommand', isSlashed);

    if (isSlashed) {
        let isShortform;
        [matchedCommand, isShortform] = matchCommand(str);
        if (matchedCommand && !isDeletion(event))
            isShortform ? expandShortform(matchedCommand) : autocompleteCommand(str, matchedCommand);
    } else {
        Filter.execute(str);
    }
}

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

    for (const shortform in SHORTFORM_TO_COMMAND)
        if (shortform.toUpperCase() === strUnslashed)
            return [SHORTFORM_TO_COMMAND[shortform], true];

    return [null, false];
}

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length, command.length + 1);
}

//@ (String) -> state
function expandShortform(command) {
    $omnibox.value = `/${command}`;
    $omnibox.select();
}

//@ -> state
export function clear() {
    $omnibox.value = $omnibox.placeholder = '';
    $omnibox.classList.remove('slashCommand');
    matchedCommand = null;
}
