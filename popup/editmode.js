import * as Popup from './popup.js';
import * as Omnibar from './omnibar.js';

export let $active = null; // Currently activated row; indicates if popup is in EditMode
const $omnibar = Omnibar.$omnibar;

const keyResponse = {
    async ArrowDown($input) {
        const error = await saveName($input);
        if (!error) shiftActive(1);
    },
    async ArrowUp($input) {
        const error = await saveName($input);
        if (!error) shiftActive(-1);
    },
    async Tab($input, event) {
        const error = await saveName($input);
        if (error) event.preventDefault();
    },
    async Enter($input) {
        const error = await saveName($input);
        if (!error) deactivate();
    },
};

async function onKeystroke(event) {
    const $target = event.target;
    const key = event.key;
    if (!isNameInput($target)) return;
    if (key in keyResponse) {
        await keyResponse[key]($target, event);
    } else {
        toggleError($target, false);
    }
}

export function activate($row = Popup.$currentWindowRow) {
    // If popup already in EditMode, just switch active rows, else activate EditMode and this row.
    $active ? deactivate(true) : activatePopup();
    $active = $row;
    const $input = $row.$input;
    $input._original = $input.value;
    $input.readOnly = false;
    $input.select();
    $row.classList.add('editMode');
}

export function deactivate(keepEditMode) {
    $active.$input.readOnly = true;
    $active.classList.remove('editMode');
    if (!keepEditMode) deactivatePopup();
}

function shiftActive(shift_by) {
    const $rows = Popup.$allWindowRows;
    const last_index = $rows.length - 1;
    const this_index = $rows.indexOf($active);
    if (this_index === -1) return;
    let new_index = this_index + shift_by;
    if (new_index < 0) {
        new_index = last_index;
    } else if (new_index > last_index) {
        new_index = 0;
    }
    activate($rows[new_index]);
}

function activatePopup() {
    $omnibar.disabled = true;
    $omnibar.value = `Edit mode: Enter to save, Esc to cancel`;
    Omnibar.showAllRows();
    document.addEventListener('keyup', onKeystroke);
}

function deactivatePopup() {
    $omnibar.disabled = false;
    $omnibar.value = '';
    $omnibar.focus();
    document.removeEventListener('keyup', onKeystroke);
    $active = null;
}

async function saveName($input) {
    const name = $input.value = $input.value.trim();
    let error = 0;
    if (name !== $input._original) {
        error = await browser.runtime.sendMessage({
            module: 'Metadata',
            prop: 'setName',
            args: [$input._id, name],
        });
    }
    toggleError($input, error);
    return error;
}

function isNameInput($el) {
    return $el.classList.contains('windowNameInput');
}

function toggleError($input, error) {
    $input.classList.toggle('inputError', error);
}
