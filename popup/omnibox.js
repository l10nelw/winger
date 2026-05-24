import {
    $omnibox,
    $newWindowRow,
} from './common.js';

import {
    COMMANDS_WITH_ARG,
    EDITMODE_VALID_COMMANDS,
    COMMAND__CALLBACK,
    SHORTHAND__COMMAND,
    addConditionalCommands,
} from './omnibox.slash.js';

import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

export function init() {
    addConditionalCommands(respondIfFilled);
    Parsed.clear();
    $omnibox.focus();
}

export const Parsed = {

    startsSlashed: false,
    command: '',
    argument: '',
    shorthand: '',

    clear() {
        Parsed.startsSlashed = false;
        Parsed.command = '';
        Parsed.argument = '';
        Parsed.shorthand = '';
    },

    /**
     * @param {string} text
     */
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
            for (const command of EDITMODE_VALID_COMMANDS) if (command.startsWith(word)) {
                Parsed.command = command;
                return;
            }
            Parsed.command = '';
            return;
        }

        for (const command in COMMAND__CALLBACK) if (command.startsWith(word)) {
            Parsed.command = command;
            return;
        }
        for (const shorthand in SHORTHAND__COMMAND) if (word === shorthand) {
            Parsed.command = SHORTHAND__COMMAND[shorthand];
            Parsed.shorthand = shorthand;
            return;
        }
        Parsed.command = '';
    },

}

/**
 * @param {KeyboardEvent} event
 * @param {{ autocomplete: boolean }} [optionDict]
 * @returns {boolean}
 */
export function handleInput(event, optionDict) {
    if (event.target !== $omnibox)
        return false;

    const str = $omnibox.value;
    Parsed.parse(str);

    Filter.execute(Parsed.startsSlashed ? '' : str);

    $omnibox.classList.toggle('slashCommand', Parsed.startsSlashed);

    if (Parsed.command && (optionDict?.autocomplete !== false) && !isDeletion(event))
        autocompleteCommand(str, Parsed.command);

    return true;
}

/**
 * If omnibox has text, respond now as if there was an input event.
 * @param {Object} [optionDict]
 * @returns {boolean}
 */
export const respondIfFilled = optionDict => !!$omnibox.value && handleInput({ target: $omnibox }, optionDict);

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleKeyDown(event) {
    const { target } = event;
    if (target === $omnibox && event.key === 'Tab' && hasSelectedText(target)) {
        event.preventDefault();
        target.setSelectionRange(-1, -1);
        return true;
    }
}

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function handleKeyUp(event) {
    if (event.target !== $omnibox)
        return false;

    if (event.key === 'Enter')
        handleEnterKey(event);

    return true;
}

/**
 * @param {KeyboardEvent} event
 */
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

    if (EditMode.isActive)
        return;

    const $action = Filter.$shownRows?.[0] || (Filter.isFiltered && $newWindowRow); // First row below omnibox
    if ($action)
        Request.action({ event, $action });
}

/** @param {KeyboardEvent} @returns {boolean} */ const isDeletion = event => event.inputType?.startsWith('delete');
/** @param {HTMLInputElement} @returns {boolean} */ const hasSelectedText = $field => $field.selectionStart !== $field.selectionEnd;

/**
 * @param {string} str
 * @param {string} command
 */
function autocompleteCommand(str, command) {
    if (str.includes(' '))
        return;
    if (COMMANDS_WITH_ARG.has(command))
        command += ' '; // Add space after an argument-accepting command for user convenience
    $omnibox.value = `/${command}`;
    $omnibox.setSelectionRange(str.length - !!Parsed.shorthand, command.length + 1);
}

export function clear() {
    Parsed.clear();
    $omnibox.value = '';
    $omnibox.classList.remove('slashCommand');
}
