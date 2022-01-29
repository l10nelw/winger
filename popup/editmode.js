/*
Edit Mode is activated at two levels, general and row (specific).
General activation governs state that persists while different rows change active status.
*/

import { hasClass, toggleClass } from '../utils.js';
import { $body, $currentWindowRow, $omnibox, getActionElements, getName } from './common.js';
import { $shownRows } from './filter.js';
import * as Tooltip from './tooltip.js';
import * as Status from './status.js';
import * as Request from './request.js';

export let $active = null; // Currently activated row; indicates if popup is in Edit Mode
let $activeName;
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
        $active.$name.focus();
        return true;
    }
}

export function activate($row = $currentWindowRow) {
    $active ? row.deactivate() : general.activate();
    row.activate($row);
}

async function done() {
    const error = await trySaveName($activeName);
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
        $omnibox.disabled = yes;
        $omnibox.placeholder = yes ? omniboxHint : '';
    },
    activate() {
        this.toggle(true);
    },
    deactivate() {
        this.toggle(false);
        $omnibox.focus();
        Status.show();
        $active = null;
    },
};

const row = {
    toggle(yes) {
        toggleClass('editModeRow', $active, yes);
        toggleClass('allowRightClick', $activeName, yes);
        $activeName.readOnly = !yes;
        $activeName.tabIndex = yes ? 0 : -1;
        const $edit = $active.$edit;
        if ($edit) [$edit.title, altTooltip] = [altTooltip, $edit.title];
    },
    activate($row) {
        showTitleInStatus($row);
        $active = $row;
        $activeName = $active.$name;
        $activeName._original = $activeName.value;
        $activeName.select();
        this.toggle(true);
    },
    deactivate() {
        $activeName.setSelectionRange(0, 0); // Ensures the beginning is visible in case of a very long name
        const name = getName($activeName);
        const $actions = [$active, ...getActionElements($active)];
        $actions.forEach($action => $action.title = Tooltip.updateName($action.title, name));
        this.toggle(false);
    },
    shiftActive(down) {
        const lastIndex = $shownRows.length - 1;
        if ($active === $currentWindowRow) return activate($shownRows[down < 0 ? lastIndex : 0]);
        const newIndex = $active._index + down;
        if (newIndex < 0 || lastIndex < newIndex) return activate($currentWindowRow);
        activate($shownRows[newIndex]);
    },
};

async function showTitleInStatus($row) {
    $row._title = $row._title || (await getFocusedTab($row._id)).title;
    Status.show($row._title);
}
const getFocusedTab = async windowId => (await browser.tabs.query({ windowId, active: true }))[0];

const keyEffects = {

    async ArrowDown() {
        const error = await trySaveName($activeName);
        if (!error) row.shiftActive(1);
    },

    async ArrowUp() {
        const error = await trySaveName($activeName);
        if (!error) row.shiftActive(-1);
    },

    async Enter() {
        if ($activeName._enter) {
            $activeName._enter = false;
            await done();
        }
    },

};

export function handleKeyUp(key, $target) {
    if ($target !== $activeName) return;
    if (key in keyEffects) {
        // If $name receives a keystroke with an effect assigned, perform effect
        keyEffects[key]();
    } else
    if ($activeName.value !== $activeName._invalid) {
        // If $name content is changed, remove any error indicator
        toggleError($activeName, false);
    }
}

// Trim content of $name and try to save it. Return 0 on success, non-zero on failure.
// Toggles error indicator accordingly.
async function trySaveName($name) {
    let error = 0;
    const name = $name.value = $name.value.trim();
    if (name !== $name._original) {
        const windowId = $name.$row._id;
        error = await Request.setName(windowId, name);
    }
    toggleError($name, error);
    return error;
}

// Toggle-on effects: apply error indicator, remember invalid content, select name field.
function toggleError($name, error) {
    toggleClass('nameError', $name, error);
    $name._invalid = error ? $name.value : null;
    if (error) $name.select();
}
