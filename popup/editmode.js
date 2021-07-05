/*
Edit Mode is activated at two levels, general and row (specific).
General activation governs state that persists while different rows change active status.
*/

import { hasClass, toggleClass } from '../utils.js';
import { $body, $currentWindowRow, $allWindowRows, getActionElements, getName } from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Tooltip from './tooltip.js';
import * as Status from './status.js';
import * as Request from './request.js';

export let $active = null; // Currently activated row; indicates if popup is in Edit Mode
let $activeInput;
let $disabledActions;

const omniboxHint = `ENTER/↑/↓: Save, ESC: Cancel`;
let altTooltip = `Save and exit Edit Mode`;


export function handleClick($target) {
    if (hasClass('edit', $target)) {
        // If target is edit button, toggle row's activation
        const $row = $target.$row;
        $row !== $active ? activate($row) : done();
        return true;
    }
    if ($active) {
        // Otherwise when in Edit Mode, return focus to active row
        $active.$input.focus();
        return true;
    }
}

export function activate($row = $currentWindowRow) {
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
        $disabledActions = $disabledActions || [...getActionElements($body, ':not(.edit)')];
        $disabledActions.forEach($action => $action.tabIndex = tabIndex);
        $body.dataset.mode = yes ? 'edit' : '';
        Omnibox.disable(yes);
        Omnibox.placeholder(yes && omniboxHint);
    },
    activate() {
        Omnibox.clear();
        Filter.execute();
        this.toggle(true);
    },
    deactivate() {
        this.toggle(false);
        Omnibox.focus();
        Status.show();
        $active = null;
    },
};

const row = {
    toggle(yes) {
        toggleClass('editModeRow', $active, yes);
        toggleClass('allowRightClick', $activeInput, yes);
        $activeInput.readOnly = !yes;
        $activeInput.tabIndex = yes ? 0 : -1;
        const $edit = $active.$edit;
        if ($edit) [$edit.title, altTooltip] = [altTooltip, $edit.title];
    },
    activate($row) {
        showTitleInStatus($row);
        $active = $row;
        $activeInput = $active.$input;
        $activeInput._original = $activeInput.value;
        $activeInput.select();
        this.toggle(true);
    },
    deactivate() {
        $activeInput.setSelectionRange(0, 0); // Ensures the beginning is visible in case of a very long name
        const name = getName($activeInput);
        const $actions = [$active, ...getActionElements($active)];
        $actions.forEach($action => $action.title = Tooltip.updateName($action.title, name));
        this.toggle(false);
    },
    shiftActive(down) {
        const $rows = $allWindowRows;
        const thisIndex = $rows.indexOf($active);
        if (thisIndex === -1) return;
        const lastIndex = $rows.length - 1;
        let newIndex = thisIndex + down;
        if (newIndex < 0) {
            newIndex = lastIndex;
        } else if (newIndex > lastIndex) {
            newIndex = 0;
        }
        activate($rows[newIndex]);
    },
};

async function showTitleInStatus($row) {
    $row._title = $row._title || (await getFocusedTab($row._id)).title;
    Status.show($row._title);
}
const getFocusedTab = async windowId => (await browser.tabs.query({ windowId, active: true }))[0];

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
        if ($activeInput._enter) {
            $activeInput._enter = false;
            await done();
        }
    },

};

export function handleKeyUp(key, $target) {
    if ($target !== $activeInput) return;
    if (key in keyEffects) {
        // If input receives a keystroke with an effect assigned, perform effect
        keyEffects[key]();
    } else
    if ($activeInput.value !== $activeInput._invalid) {
        // If input content is changed, remove any error indicator
        toggleError($activeInput, false);
    }
}

// Trim content of input and try to save it. Return 0 on success, non-zero on failure.
// Toggles error indicator accordingly.
async function trySaveName($input) {
    let error = 0;
    const name = $input.value = $input.value.trim();
    if (name !== $input._original) {
        const windowId = $input.$row._id;
        error = await Request.setName(windowId, name);
    }
    toggleError($input, error);
    return error;
}

// Toggle-on effects: apply error indicator, remember invalid content, select input.
function toggleError($input, error) {
    toggleClass('inputError', $input, error);
    $input._invalid = error ? $input.value : null;
    if (error) $input.select();
}
