const $form = document.querySelector('form');
$form.onchange = set;

function set(event) {
    const $target = event.target;
    const name = $target.name;
    const setting = {};
    setting[name] = getValue(name, $target);
    browser.storage.local.set(setting);
}

function getValue(name, $target) {
    const $field = $form[name];
    if ($target.type == 'checkbox') {
        if ($field.length) {
            return [...$field].filter($i => $i.checked).map($i => $i.value); // array
        }
        return $field.checked; // boolean
    }
    return $field.value; // string
}
