// Slash commands

import {
    FLAGS,
    nameMap,
    $omnibox,
    $names,
    $otherWindowRows,
} from './common.js';
import * as EditMode from './editmode.js';
import * as Request from './request.js';
import * as Row from './row.js';
import * as Toolbar from './toolbar.js';
import { isWindowId } from '../utils.js';
import { set as setStorage } from '../storage.js';

/** @import { NameField$ } from './common.js' */
/**
 * @callback CommandCallback
 * @param {Object} [info]
 * @param {KeyboardEvent} [info.event]
 * @param {string} [info.argument]
 */

export const COMMANDS_WITH_ARG = new Set([
    'new', 'newnormal', 'newprivate', 'pop', 'popnormal', 'popprivate', 'kick', 'kicknormal', 'kickprivate', // new/pop/kick
    'name', 'extractname', 'extractallnames', // naming
]);

export const EDITMODE_VALID_COMMANDS = new Set(['help', 'settings', 'options', 'edit', 'viewstash']);

export const SHORTHAND__COMMAND = { exa: 'extractallnames' };

/**
 * @param {string} command
 * @returns {CommandCallback}
 */
const namingActionRequestFn = command =>
    ({ event, argument }) => Request.action({ event, command, argument: nameMap.validUniqueName(argument) });

/**
 * @type {Object<string, CommandCallback>}
 */
export const COMMAND__CALLBACK = {
    help:     Toolbar.help,
    settings: Toolbar.settings,
    options:  Toolbar.settings,
    edit:     EditMode.toggle,

    new:  namingActionRequestFn('new'),
    pop:  namingActionRequestFn('pop'),
    kick: namingActionRequestFn('kick'),

    /**
     * @param {Object} arg
     * @param {string} arg.argument
     */
    async name({ argument }) {
        const $name = $names[0];
        if (argument === $name.value)
            return;
        const name = nameMap.validUniqueName(argument);
        if (await EditMode.saveNameUpdateField($name, name))
            $name.value = name;
    },

    /**
     * @param {Object} arg
     * @param {string} arg.argument
     * @param {NameField$} [arg.$name] - Given by `extractallnames`
     * @param {RegExp} [arg.regex] - Given by `extractallnames`
     */
    async extractname({ argument, $name, regex }) {
        const isSingular = !$name || !regex; // `extractname` invoked by user, not by `extractallnames`
        if (isSingular) {
            $name = $names[0]; // Target is current window
            regex = createRegex(argument);
        }

        if (!regex)
            return;
        const result = $name.placeholder.match(regex);
        let name = (result[1] || result[0])?.trim();
        if (name === $name.value)
            return;
        name = nameMap.validUniqueName(name);
        if (!await EditMode.saveNameUpdateField($name, name))
            return;
        $name.value = name;
        const id = $name._id;

        if (isSingular) {
            isWindowId(id) && Request.updateByUser(id, name); // Update current window only
            EditMode.finalizePopupUpdate();
        }
    },

    /**
     * @param {Object} arg
     * @param {string} arg.argument
     */
    async extractallnames({ argument }) {
        const regex = new RegExp(argument);
        for (const $name of $names)
            await COMMAND__CALLBACK.extractname({ argument, $name, regex }); // Await each one to resolve any duplicate names
        Request.updateByUser(); // Update all windows simultaneously
        EditMode.finalizePopupUpdate();
    },
}

/**
 * Add commands that are only available if allowed by settings.
 * @param {Function} Omnibox_respondIfFilled
 */
export async function addConditionalCommands(Omnibox_respondIfFilled) {
    if (FLAGS.enable_stash) {
        COMMAND__CALLBACK.stash = ({ event }) => Request.action({ command: 'stash', event });

        COMMAND__CALLBACK.viewstash = async function () {
            // Create folder rows if absent
            if (!$otherWindowRows.$stashed) {
                Placeholder.set('Loading stashed windows...', 'info');
                const folders = await Request.popupStashItems();
                Placeholder.reset();
                if (!folders.length)
                    return Placeholder.flash('No stashed windows found', 'info');
                Row.addFolders(folders);
            }

            Row.toggleViewFolders({ scrollIntoView: true });
            Omnibox_respondIfFilled({ autocomplete: false });

            // Toggle `show_popup_stashed_items` setting
            FLAGS.show_popup_stashed_items = !FLAGS.show_popup_stashed_items;
            setStorage({ show_popup_stashed_items: FLAGS.show_popup_stashed_items });
        };
    }

    if (FLAGS.allow_private) {
        const shorthandDict = {
            nn: 'newnormal',
            pn: 'popnormal',
            kn: 'kicknormal',
            np: 'newprivate',
            pp: 'popprivate',
            kp: 'kickprivate',
        };
        for (const shorthand in shorthandDict) {
            const command = shorthandDict[shorthand];
            COMMAND__CALLBACK[command] = namingActionRequestFn(command);
            SHORTHAND__COMMAND[shorthand] = command;
        }
    }
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
