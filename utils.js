export function hasClass(cls, $element) {
    return $element.classList.contains(cls);
}

export function sum(array) {
    return array.reduce((a, b) => a + b, 0);
}

export function end(sequence) {
    return sequence[sequence.length - 1];
}

export function getModifiers(event) {
    let modifiers = [];
    for (const prop in event) {
        if (prop.endsWith('Key') && event[prop]) {
            const modifier = prop[0].toUpperCase() + prop.slice(1, -3);
            modifiers.push(modifier);
        }
    }
    return modifiers;
}
