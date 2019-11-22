import * as Omnibar from './omnibar.js';

export let isActive = false;
export const $toggler = document.getElementById('editMode');
const $omnibar = Omnibar.$omnibar;
let $nameInputs;
let newNames = {};

$toggler.addEventListener('change', onToggle);


export function active(status) {
    $toggler.checked = status;
    onToggle();
}

function onToggle() {
    isActive = $toggler.checked;

    $omnibar.disabled = isActive;
    $omnibar.value = isActive ? `Edit mode: Enter to save, Esc to cancel` : ``;
    if (isActive) {
        $nameInputs = Array.from(document.querySelectorAll('.windowNameInput'));
        $nameInputs.forEach($i => $i._original = $i.value);
        $nameInputs[0].select();
        Omnibar.showAllRows();
    } else {
        saveNewNames();
        Omnibar.$omnibar.focus();
    }
    $nameInputs.forEach($i => $i.readOnly = !isActive);
    document.body.classList.toggle('editMode', isActive);

    const eventListenerAction = isActive ? 'addEventListener' : 'removeEventListener';
    document[eventListenerAction]('focusout', onNameEntered);
    document[eventListenerAction]('keyup', onKeystroke);
}

function onKeystroke(event) {
    const $target = event.target;
    switch (event.key) {
        case 'ArrowDown': shiftSelectedName($target, 1); break;
        case 'ArrowUp': shiftSelectedName($target, -1);
    }
}

function shiftSelectedName($target, shiftBy) {
    const lastIndex = $nameInputs.length - 1;
    let newIndex;
    if (isNameInput($target)) {
        const thisIndex = $nameInputs.indexOf($target);
        if (thisIndex == -1) return;
        newIndex = thisIndex + shiftBy;
        if (newIndex < 0) {
            newIndex = lastIndex;
        } else if (newIndex > lastIndex) {
            newIndex = 0;
        }
    } else {
        newIndex = shiftBy < 0 ? lastIndex : 0;
    }
    $nameInputs[newIndex].select();
}

function onNameEntered(event) {
    const $input = event.target;
    if (!isNameInput($input)) return;

    const name = $input.value;
    $input.value = name.trim();

    // Catch the duplicates, validate the rest
    const $dupes = findDuplicates();
    const $others = $nameInputs.filter($i => !$dupes.includes($i));
    $dupes.forEach(showError);
    $others.forEach(validateName);
}

function findDuplicates() {
    const $filledInputs = $nameInputs.filter($i => $i.value);
    let $dupes = new Set();
    for (const $input of $filledInputs) {
        const name = $input.value;
        for (const $compare of $filledInputs) {
            if ($compare.value === name && $compare !== $input) {
                $dupes.add($input);
                $dupes.add($compare);
            }
        }
    }
    return Array.from($dupes);
}

function validateName($input) {
    const name = $input.value;
    if (name === $input._original) {
        // Not new name
        resetError($input);
    } else if (name) {
        // Check if name has invalid chars or is a duplicate of any names in metadata
        const windowId = $input._id;
        browser.runtime.sendMessage({
            module: 'Metadata',
            prop: 'isInvalidName',
            args: [windowId, name],
        })
        .then(status => {
            const $input = $nameInputs.find($i => $i._id == windowId);
            status ? showError($input) : markNewName($input);
        });
    } else {
        // Blank is valid
        markNewName($input);
    }
}

function markNewName($input) {
    resetError($input);
    newNames[$input._id] = $input.value;
}

function saveNewNames() {
    browser.runtime.sendMessage({
        module: 'Metadata',
        prop: 'saveNewNames',
        args: [newNames, true],
    });
}

function isNameInput($input) {
    return '_id' in $input;
}

function showError($input) {
    $input.classList.add('inputError');
    $toggler.disabled = true;
}

function resetError($input) {
    $input.classList.remove('inputError');
    $toggler.disabled = !!document.querySelector('.inputError');
}
