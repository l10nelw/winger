import {
    $omnibox,
    nameMap,
} from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';
import * as Name from '../name.js';

const COMMAND__CALLBACK = {
    help:        Toolbar.help,
    settings:    Toolbar.settings,
    edit:        () => EditMode.toggle(),
    new:         ({ event, argument }) => Request.action({ event, argument, command: 'new' }),
    newprivate:  ({ event, argument }) => Request.action({ event, argument, command: 'newprivate' }),
    pop:         ({ event, argument }) => Request.action({ event, argument, command: 'pop' }),
    popprivate:  ({ event, argument }) => Request.action({ event, argument, command: 'popprivate' }),
    kick:        ({ event, argument }) => Request.action({ event, argument, command: 'kick' }),
    kickprivate: ({ event, argument }) => Request.action({ event, argument, command: 'kickprivate' }),
    stash:       ({ event }) => Request.stash(!event.shiftKey),
};
// Aliases
COMMAND__CALLBACK.options = () => COMMAND__CALLBACK.settings();
COMMAND__CALLBACK.name = () => COMMAND__CALLBACK.edit();

const SHORTHAND__COMMAND = {
    np: 'newprivate',
    pp: 'popprivate',
    kp: 'kickprivate',
};
const COMMANDS_WITH_ARG = new Set(['new', 'newprivate', 'pop', 'popprivate', 'kick', 'kickprivate']);
const EDITMODE_VALID_COMMANDS = new Set(['help', 'settings', 'options', 'edit', 'name']);

const Parsed = {

    clear() {
        Parsed.startsSlashed = false;
        Parsed.command = '';
        Parsed.argument = '';
        Parsed.shorthand = '';
    },

    parse(text) {
        if (!text.startsWith('/')) {
            Parsed.clear();
            return;
        }
        text = text.slice(1); // Remove slash
        Parsed.startsSlashed = true;

        // Split text at first space into command and argument
        const [command, ...argument] = text.split(' ');
        Parsed.command = command.toLowerCase();
        Parsed.argument = argument?.filter(Boolean).join(' ') ?? '';

        Parsed._matchCommand();
    },

    _matchCommand() {
        Parsed.shorthand = '';
        const word = Parsed.command;

        if (word === 'debug')
            return;

        if (EditMode.isActive) {
            for (const command of EDITMODE_VALID_COMMANDS) {
                if (command.startsWith(word)) {
                    Parsed.command = command;
                    return;
                }
            }
            Parsed.command = '';
            return;
        }

        for (const command in COMMAND__CALLBACK) {
            if (command.startsWith(word)) {
                Parsed.command = command;
                return;
            }
        }
        for (const shorthand in SHORTHAND__COMMAND) {
            if (word === shorthand) {
                Parsed.command = SHORTHAND__COMMAND[shorthand];
                Parsed.shorthand = shorthand;
                return;
            }
        }
        Parsed.command = '';
    },

}

//@ (Boolean) -> state
export function init({ enable_stash }) {
    Parsed.clear();
    if (!enable_stash)
        delete COMMAND__CALLBACK.stash;
}

//@ (Object), state -> state
export function handleInput(event) {
    if (event.target !== $omnibox)
        return false;

    const str = $omnibox.value;
    Parsed.parse(str);

    Filter.execute(Parsed.startsSlashed ? '' : str);

    $omnibox.classList.toggle('slashCommand', Parsed.startsSlashed);

    if (Parsed.command && !isDeletion(event))
        autocompleteCommand(str, Parsed.command);

    return true;
}

//@ (Object), state -> state
export function handleKeyDown(event) {
    const { target } = event;
    if (target === $omnibox && event.key === 'Tab' && hasSelectedText(target)) {
        event.preventDefault();
        target.setSelectionRange(-1, -1);
        return true;
    }
}

//@ (Object), state -> state
export function handleKeyUp(event) {
    if (event.target !== $omnibox)
        return false;

    if (event.key === 'Enter')
        handleEnterKey(event);

    return true;
}

//@ (Object), state -> state
function handleEnterKey(event) {
    if (Parsed.command === 'debug') {
        Request.debug();
        clear();
        return;
    }

    let { command, argument } = Parsed;
    if (command) {
        const callback = COMMAND__CALLBACK[command];
        if (COMMANDS_WITH_ARG.has(command))
            argument = validifyName(argument);
        callback?.({ event, argument });
        clear();
        return;
    }

    if (Parsed.startsSlashed) {
        clear();
        return;
    }

    if (!EditMode.isActive) {
        const $action = Filter.$shownRows[0]; // First row below omnibox
        if ($action)
            Request.action({ event, $action });
    }
}

//@ (Object) -> (Boolean)
const isDeletion = event => event.inputType.startsWith('delete');
const hasSelectedText = $field => $field.selectionStart !== $field.selectionEnd;

//@ (String), state -> (String)
function validifyName(name) {
    name = Name.validify(name);
    return name ?
        nameMap.ready().uniquify(name) : '';
}

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    if (str.includes(' '))
        return;
    command = addSpaceIfAcceptsArgument(command);
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length - !!Parsed.shorthand, command.length + 1);
}

// Add space after an argument-accepting command for user convenience.
//@ (String) -> (String)
function addSpaceIfAcceptsArgument(command) {
    return COMMANDS_WITH_ARG.has(command) ?
        command + ' ' : command;
}

//@ -> state
export function clear() {
    Parsed.clear();
    $omnibox.value = '';
    $omnibox.classList.remove('slashCommand');
}
