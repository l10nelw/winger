import {
    FLAGS,
    nameMap,
    $omnibox,
    $names,
    $otherWindowRows,
} from './common.js';
import * as EditMode from './editmode.js';
import * as Filter from './filter.js';
import * as Request from './request.js';
import * as Row from './row.js';
import * as Toolbar from './toolbar.js';

import { validify } from '../name.js';
import { set } from '../storage.js';

/** @import { NameField$ } from './common.js' */
/**
 * @callback CommandCallback
 * @param {Object} [info]
 * @param {KeyboardEvent} [info.event]
 * @param {string} [info.argument]
 */

const COMMANDS_WITH_ARG = new Set([
    'new', 'newnormal', 'newprivate', 'pop', 'popnormal', 'popprivate', 'kick', 'kicknormal', 'kickprivate',
    'name', 'extractname', 'extractallnames',
]);
const EDITMODE_VALID_COMMANDS = new Set(['help', 'settings', 'options', 'edit', 'viewstash']);

/**
 * @param {string} command
 * @returns {CommandCallback}
 */
const namingActionRequestFn = command =>
    ({ event, argument }) => Request.action({ event, command, argument: validUniqueName(argument) });

/**
 * @param {string} name
 * @returns {string}
 */
const validUniqueName = name => nameMap.ready().uniquify(validify(name));

/**
 * @type {Object<string, CommandCallback>}
 */
const COMMAND__CALLBACK = {
    help:     Toolbar.help,
    settings: Toolbar.settings,
    options:  Toolbar.settings,
    edit:     EditMode.toggle,

    new:  namingActionRequestFn('new'),
    pop:  namingActionRequestFn('pop'),
    kick: namingActionRequestFn('kick'),

    async name({ argument }) {
        const $name = $names[0];
        if (argument === $name.value)
            return;
        const name = validUniqueName(argument);
        if (await EditMode.saveNameUpdateUI($name, name))
            $name.value = name;
    },

    /**
     * @param {Object} arg
     * @param {string} arg.argument
     * @param {NameField$} [arg.$name]
     * @param {RegExp} [arg.regex]
     */
    async extractname({ argument, $name, regex }) {
        $name ??= $names[0];
        regex ??= createRegex(argument);
        if (!regex)
            return;
        const result = $name.placeholder.match(regex);
        let name = (result[1] || result[0])?.trim();
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

const SHORTHAND__COMMAND = { exa: 'extractallnames' };

export function init() {
    Parsed.clear();

    if (FLAGS.enable_stash) {
        COMMAND__CALLBACK.stash = ({ event }) => Request.action({ command: 'stash', event });

        COMMAND__CALLBACK.viewstash = async function () {
            // Create folder rows if absent
            if (!$otherWindowRows.$stashed) {
                Placeholder.set('Loading stashed windows...', 'info');
                const folders = await Request.popupStash();
                Placeholder.reset();
                if (!folders.length)
                    return Placeholder.flash('No stashed windows found', 'info');
                Row.addAllFolders(folders);
            }

            Row.toggleViewFolders({ scrollIntoView: true });
            respondIfFilled({ autocomplete: false });

            // Toggle `show_popup_stashed_items` setting
            FLAGS.show_popup_stashed_items = !FLAGS.show_popup_stashed_items;
            set({ show_popup_stashed_items: FLAGS.show_popup_stashed_items });
        };
    }

    if (FLAGS.allow_private) {
        COMMAND__CALLBACK.newnormal   = namingActionRequestFn('newnormal');
        COMMAND__CALLBACK.popnormal   = namingActionRequestFn('popnormal');
        COMMAND__CALLBACK.kicknormal  = namingActionRequestFn('kicknormal');
        COMMAND__CALLBACK.newprivate  = namingActionRequestFn('newprivate');
        COMMAND__CALLBACK.popprivate  = namingActionRequestFn('popprivate');
        COMMAND__CALLBACK.kickprivate = namingActionRequestFn('kickprivate');
        SHORTHAND__COMMAND.nn = 'newnormal';
        SHORTHAND__COMMAND.pn = 'popnormal';
        SHORTHAND__COMMAND.kn = 'kicknormal';
        SHORTHAND__COMMAND.np = 'newprivate';
        SHORTHAND__COMMAND.pp = 'popprivate';
        SHORTHAND__COMMAND.kp = 'kickprivate';
    }

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

    if (Parsed.command && optionDict?.autocomplete !== false && !isDeletion(event))
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

    const $action = Filter.$shownRows?.[0]; // First row below omnibox
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

/**
 * @param {string} str
 * @returns {RegExp?}
 */
function createRegex(str) {
    try {
        return new RegExp(str);
    } catch (e) {
        Placeholder.flash(`RegExp ${e}`, 'error');
    }
}

const Placeholder = {
    TIMEOUT: 1500,
    ORIGINAL: $omnibox.placeholder,
    className: '',

    /**
     * @param {string} text
     * @param {string} className
     */
    set(text, className) {
        Placeholder.className = className;
        $omnibox.classList.add(className);
        $omnibox.placeholder = text;
    },

    reset() {
        $omnibox.placeholder = Placeholder.ORIGINAL;
        $omnibox.classList.remove(Placeholder.className);
        Placeholder.className = '';
    },

    /**
     * @param {string} text
     * @param {string} className
     * @param {number} [time]
     */
    flash(text, className, time = this.TIMEOUT) {
        Placeholder.set(text, className);
        setTimeout(Placeholder.reset, time);
    },
}