/*
Edit Mode is activated on two levels, general and row (specific).
General activation governs state that is sustained even while different rows change active status.
*/

import { hasClass, toggleClass } from '../utils.js';
import * as Popup from './popup.js';
import * as Omnibar from './omnibar.js';

export let $active = null; // Currently activated row; indicates if popup is in Edit Mode
let $activeInput;
let $disabledActions;
let $rows, lastIndex; // 'Constants' for row.shiftActive(), set in general.activate()
const $editMode = document.getElementById('editMode');
const $body = document.body;

const omnibarText = `Enter/Up/Down to save, Esc to cancel`;
let altTooltip = `Save and exit Edit Mode`;


export function handleClick($target) {
    let handled = false;
    if (hasClass('edit', $target)) {
        // If target is edit button, toggle row's activation
        const $row = $target.$row;
        $row != $active ? activate($row) : done();
        handled = true;
    } else if ($active) {
        // Otherwise when in Edit Mode, return focus to active row
        $active.$input.focus();
        handled = true;
    }
    return handled;
}

export function activate($row = Popup.$currentWindowRow) {
    $active ? row.deactivate() : general.activate();
    row.activate($row);
}

async function done() {
    const error = await trySaveName($activeInput);
    if (error) return;
    row.deactivate();
    general.deactivate();
}

const general = {

    toggle(yes) {
        const tabIndex = yes ? -1 : 0;
        $disabledActions = $disabledActions || [...Popup.getActionElements($body, ':not(.edit)')];
        $disabledActions.forEach($action => $action.tabIndex = tabIndex);
        const evLi = yes ? 'addEventListener' : 'removeEventListener';
        $body[evLi]('keyup', onKeyUp);
        $body[evLi]('focusout', onFocusout);
        $editMode.checked = yes;
        Omnibar.disable(yes);
        Omnibar.info(yes ? omnibarText : '');
    },

    activate() {
        this.toggle(true);
        Omnibar.showAllRows();
        $rows = Popup.$allWindowRows;
        lastIndex = $rows.length - 1;
    },

    deactivate() {
        this.toggle(false);
        Omnibar.focus();
        $active = null;
    },

};

const row = {

    toggle(yes) {
        toggleClass('editModeRow', $active, yes);
        toggleClass('allowRightClick', $activeInput, yes);
        $activeInput.readOnly = !yes;
        $activeInput.tabIndex = yes ? 0 : -1;
        [$active.$edit.title, altTooltip] = [altTooltip, $active.$edit.title];
    },

    activate($row) {
        $active = $row;
        $activeInput = $active.$input;
        $activeInput._original = $activeInput.value;
        $activeInput.select();
        this.toggle(true);
    },

    deactivate() {
        const $row = $active;
        const displayName = Popup.getDisplayName($activeInput);
        this.toggle(false);
        for (const $action of [$row, ...Popup.getActionElements($row)]) {
            $action.title = Popup.updateTooltipName($action.title, displayName);
        }
    },

    shiftActive(down) {
        const thisIndex = $rows.indexOf($active);
        if (thisIndex == -1) return;
        let newIndex = thisIndex + down;
        if (newIndex < 0) {
            newIndex = lastIndex;
        } else if (newIndex > lastIndex) {
            newIndex = 0;
        }
        activate($rows[newIndex]);
    },

};

const keyEffects = {

    async ArrowDown() {
        const error = await trySaveName($activeInput);
        if (!error) row.shiftActive(1);
    },

    async ArrowUp() {
        const error = await trySaveName($activeInput);
        if (!error) row.shiftActive(-1);
    },

    async Enter() {
        await done();
    },

};

async function onKeyUp(event) {
    if (event.target != $activeInput) return;
    const key = event.key;
    if (key in keyEffects) {
        // If input receives a keystroke with an effect assigned, perform effect
        await keyEffects[key]();
    } else if ($activeInput.value != $activeInput._invalid) {
        // If input content is changed, remove any error indicator
        toggleError($activeInput, false);
    }
}

function onFocusout(event) {
    if (event.target != $activeInput) return;
    trySaveName($activeInput);
}

// Trim content of input and try to save it. Return 0 on success, non-zero on failure.
// Toggles error indicator accordingly.
async function trySaveName($input) {
    const name = $input.value = $input.value.trim();
    let error = 0;
    if (name !== $input._original) {
        error = await browser.runtime.sendMessage({ giveName: true, windowId: $input.$row._id, name });
    }
    toggleError($input, error);
    return error;
}

// Toggle-on effects: apply error indicator, remember invalid content, select input.
function toggleError($input, error) {
    toggleClass('inputError', $input, error);
    $input._invalid = error ? $input.value : undefined;
    if (error) $input.select();
}
