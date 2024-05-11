import {
    FLAGS,
    $omnibox,
    nameMap,
    $names,
} from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';
import { validify } from '../name.js';

const COMMAND__CALLBACK = {
    help:     Toolbar.help,
    settings: Toolbar.settings,
    options:  Toolbar.settings,
    edit:     EditMode.toggle,

    async name({ argument }) {
        const $name = $names[0];
        if (argument === $name.value)
            return;
        const name = validUniqueName(argument);
        if (await EditMode.saveNameUpdateUI($name, name))
            $name.value = name;
    },

    new:  ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'new' }),
    pop:  ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'pop' }),
    kick: ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'kick' }),

    async extractname({ argument, $name, regex }) {
        $name ??= $names[0];
        regex ??= new RegExp(argument);
        let name = $name.placeholder.match(regex)[1]?.trim();
        if (name === $name.value)
            return;
        name = validUniqueName(name);
        if (await EditMode.saveNameUpdateUI($name, name))
            $name.value = name;
    },

    async extractallnames({ argument }) {
        const regex = new RegExp(argument);
        for (const $name of $names)
            await COMMAND__CALLBACK.extractname({ argument, $name, regex });
    },
};

const COMMANDS_WITH_ARG = new Set(['new', 'newprivate', 'pop', 'popprivate', 'kick', 'kickprivate', 'name', 'extractname', 'extractallnames']);
const EDITMODE_VALID_COMMANDS = new Set(['help', 'settings', 'options', 'edit']);
const SHORTHAND__COMMAND = {
    exa: 'extractallnames',
};

//@ state -> state
export function init() {
    Parsed.clear();
    if (FLAGS.enable_stash) {
        COMMAND__CALLBACK.stash = ({ event }) => Request.stash(event);
    }
    if (FLAGS.allow_private) {
        COMMAND__CALLBACK.newprivate  = ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'newprivate' });
        COMMAND__CALLBACK.popprivate  = ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'popprivate' });
        COMMAND__CALLBACK.kickprivate = ({ event, argument }) => Request.action({ event, argument: validUniqueName(argument), command: 'kickprivate' });
        SHORTHAND__COMMAND.np = 'newprivate';
        SHORTHAND__COMMAND.pp = 'popprivate';
        SHORTHAND__COMMAND.kp = 'kickprivate';
    }
    $omnibox.focus();
}

//@ (String), state -> (String)
const validUniqueName = name => nameMap.ready().uniquify(validify(name));

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
        Parsed.startsSlashed = true;
        text = text.slice(1); // Remove slash

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
        callback?.({ event, argument });
        clear();
        return;
    }

    if (Parsed.startsSlashed) {
        clear();
        return;
    }

    if (!EditMode.isActive) {
        const $action = Filter.$shownRows?.[0]; // First row below omnibox
        if ($action)
            Request.action({ event, $action });
    }
}

//@ (Object) -> (Boolean)
const isDeletion = event => event.inputType.startsWith('delete');
const hasSelectedText = $field => $field.selectionStart !== $field.selectionEnd;

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    if (str.includes(' '))
        return;
    if (COMMANDS_WITH_ARG.has(command))
        command += ' '; // Add space after an argument-accepting command for user convenience
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length - !!Parsed.shorthand, command.length + 1);
}

//@ -> state
export function clear() {
    Parsed.clear();
    $omnibox.value = '';
    $omnibox.classList.remove('slashCommand');
}
