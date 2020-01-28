export function hasClass(cls, $element) {
    return $element && $element.classList.contains(cls);
}

export function sum(array) {
    return array.reduce((a, b) => a + b, 0);
}

export function end(sequence) {
    return sequence[sequence.length - 1];
}

// Return array of active modifiers in the form of ['Alt', 'Ctrl', 'Shift'] or parts thereof or [].
export function getModifiers(event) {
    return ['altKey', 'ctrlKey', 'shiftKey'].filter(m => event[m]).map(m => m[0].toUpperCase() + m.slice(1, -3));
}
