export let active = false;
const $toggler = document.getElementById('editMode');
const $commandInput = document.getElementById('commandInput');
let Port;
let $nameInputs;
let namesToSave = {};

export function init(port) {
    Port = port;
    Port.onMessage.addListener(handleMessage);
    $toggler.addEventListener('change', toggle);
}

function handleMessage(message) {
    switch (message.response) {
        case 'EditMode.validateName': {
            const status = message.result;
            const windowId = message.windowId;
            const $input = $nameInputs.find($i => $i._id == windowId);
            if (status) {
                showError($input);
            } else {
                markNameToSave(windowId, $input.value);
            }
        }
    }
}

function toggle() {
    active = $toggler.checked;
    if (active) {
        $nameInputs = Array.from(document.querySelectorAll('.windowNameInput'));
        $nameInputs[0].select();
        document.body.addEventListener('focusout', onInput);
    } else {
        saveNames();
        document.body.removeEventListener('focusout', onInput);
    }
    $nameInputs.forEach($i => $i.readOnly = !active);
    $commandInput.disabled = active;
    $commandInput.placeholder = active ? `Edit mode: Enter to save, Esc to cancel` : ``;
    document.body.classList.toggle('editMode', active);
}

function onInput(event) {
    const $input = event.target;
    if (!$input.classList.contains('windowNameInput')) return;

    const name = $input.value;
    $input.value = name.trim();
    resetErrors();

    const $dupes = findDuplicates();
    $dupes.forEach(showError);
    validateName($input);
}

function validateName($input) {
    const name = $input.value;
    const windowId = $input._id;
    if (name) {
        // Check if this name has invalid chars or is a duplicate of any names in metadata
        Port.postMessage({
            request: 'EditMode.validateName',
            windowId,
            module: 'Metadata',
            prop: 'isInvalidName',
            args: [windowId, name],
        });
    } else {
        // Blank: clear this window's givenName
        markNameToSave(windowId, '');
    }
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

function showError($input) {
    $input.classList.add('inputError');
    $toggler.disabled = true;
}

function resetErrors() {
    $nameInputs.forEach($i => $i.classList.remove('inputError'));
    $toggler.disabled = false;
}

function markNameToSave(windowId, name) {
    namesToSave[windowId] = name;
}

function saveNames() {
    Port.postMessage({
        command: true,
        module: 'Metadata',
        prop: 'saveNames',
        args: [namesToSave, true],
    });
}