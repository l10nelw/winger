export function hasClass(cls, $element) {
    return $element.classList.contains(cls);
}

export function sum(array) {
    return array.reduce((a, b) => a + b, 0);
}

export function end(sequence) {
    return sequence[sequence.length - 1];
}