import { $omnibox } from './common.js';
import * as Toolbar from './toolbar.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

const COMMAND__CALLBACK = {
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
const ALIAS__COMMAND = {
    options: 'settings',
    name: 'edit',
};
const SHORTHAND__COMMAND = {
    np: 'newprivate',
    pp: 'popprivate',
    kp: 'kickprivate',
};

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
        for (const command in COMMAND__CALLBACK) {
            if (command.startsWith(word)) {
                Parsed.command = command;
                return;
            }
        }
        for (const alias in ALIAS__COMMAND) {
            if (alias.startsWith(word)) {
                Parsed.command = alias;
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
    const str = $omnibox.value;
    Parsed.parse(str);

    $omnibox.classList.toggle('slashCommand', Parsed.startsSlashed);

    if (Parsed.startsSlashed) {
        if (Parsed.command && !isDeletion(event))
            Parsed.shorthand ? expandShorthand(Parsed.command) : autocompleteCommand(str, Parsed.command);
    } else {
        Filter.execute(str);
    }
}

//@ (String, Object), state -> state
export function handleKeyUp(event) {
    if (event.key === 'Enter')
        handleEnter(event);
}

//@ (Object), state -> state
function handleEnter(event) {
    if (Parsed.command === 'debug') {
        Request.debug();
        clear();
        return;
    }
    if (Parsed.command) {
        const callback = COMMAND__CALLBACK[Parsed.command] || COMMAND__CALLBACK[ALIAS__COMMAND[Parsed.command]];
        callback?.(event);
        clear();
        return;
    }
    if (Parsed.startsSlashed) {
        clear();
        return;
    }
    if (!EditMode.isActive) {
        const $firstRow = Filter.$shownRows?.[0];
        if ($firstRow)
            Request.action(event, $firstRow);
    }
}

//@ (Object) -> (Boolean)
const isDeletion = event => event.inputType.startsWith('delete');

//@ (String, String) -> state
function autocompleteCommand(str, command) {
    if (str.includes(' '))
        return;
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length, command.length + 1);
}

//@ (String) -> state
function expandShorthand(command) {
    $omnibox.value = `/${command}`;
}

//@ -> state
export function clear() {
    Parsed.clear();
    $omnibox.value = '';
    $omnibox.classList.remove('slashCommand');
}
