export let active = false;
const $toggler = document.getElementById('editMode');
const $commandInput = document.getElementById('commandInput');
let Port;
let $nameInputs;
let namesToSave = {};

export function init(port) {
    Port = port;
    $toggler.addEventListener('change', toggle);
}

export function handleMessage(message) {
    switch (message.response) {
        case 'EditMode.validateName': {
            const status = message.result;
            const windowId = message.windowId;
            const $input = $nameInputs.find($i => $i._id == windowId);
            status ? showError($input) : markNameToSave(windowId, $input.value);
        }
    }
}

function toggle() {
    active = $toggler.checked;
    if (active) {
        $nameInputs = [...document.querySelectorAll('.windowNameInput')];
        document.body.addEventListener('change', onInputChange);
        $nameInputs[0].select();
    } else {
        document.body.removeEventListener('change', onInputChange);
        saveNames();
    }
    $nameInputs.forEach($i => $i.readOnly = !active);
    $commandInput.disabled = active;
    $commandInput.placeholder = active ? `Edit mode: Enter to save, Esc to cancel` : ``;
    document.body.classList.toggle('editMode', active);
}

function onInputChange(event) {
    const $input = event.target;
    if (!$input.classList.contains('windowNameInput')) return;

    const name = $input.value;
    $input.value = name.trim();
    resetErrors();
    validateName($input);
}

function validateName($input) {
    const windowId = $input._id;
    const name = $input.value;
    if (!name) {
        // blank is valid
        markNameToSave(windowId, '');
    } else if (nameIsDuplicate($input)) {
        // duplicate names entered in edit mode
        showError($input);
    } else {
        // find duplicate names existing in metadata
        // check for invalid chars
        Port.postMessage({
            request: 'EditMode.validateName',
            windowId,
            module: 'Metadata',
            prop: 'isInvalidName',
            args: [windowId, name],
        });
    }
}

function nameIsDuplicate($input) {
    const name = $input.value;
    return name && $nameInputs.find($i => $i !== $input && $i.value === name);
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