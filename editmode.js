export let active = false;
let Port;
let $toggler;
let $nameInputs;

export function init(port) {
    Port = port;
    $toggler = document.getElementById('editMode');
    $toggler.addEventListener('change', toggle);
}

export function handleMessage(message) {
    switch (message.response) {
        case 'editMode isInvalidName': {
            const status = message.result;
            const windowId = message.windowId;
            if (status) {
                const $offender = $nameInputs.find($input => $input._id === windowId);
                showError($offender);
            }
        }
    }
}

function toggle() {
    active = $toggler.checked;
    if (active) $nameInputs = [...document.querySelectorAll('.windowNameInput')];
    $nameInputs.forEach($input => $input.readOnly = !active);
    document.body[active ? 'addEventListener' : 'removeEventListener']('change', onInputChange);
}

function onInputChange(event) {
    const $target = event.target;
    if (!$target.classList.contains('windowNameInput')) return;

    const name = $target.value;
    $target.value = name.trim();
    resetErrors();

    if (duplicatedName($target)) {
        inputError($target);
    } else {
        const windowId = $target._id;
        Port.postMessage({
            request: 'editMode isInvalidName',
            windowId,
            module: 'Metadata',
            prop: 'isInvalidName',
            args: [windowId, name],
        });
    }
}

function duplicatedName($target) {
    const name = $target.value;
    return $nameInputs.find($input => $input !== $target && $input.value === name);
}

function inputError($input) {
    $input.classList.add('inputError');
}

function resetErrors() {
    $nameInputs.forEach($input => $input.classList.remove('inputError'));
}
