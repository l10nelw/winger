export const hasClass = (cls, $element) => $element && $element.classList.contains(cls);

export const sum = array => array.reduce((a, b) => a + b, 0);

export const end = sequence => sequence[sequence.length - 1];

// Return array of active modifiers in the form of ['Alt', 'Ctrl', 'Shift'] or parts thereof or [].
export const getModifiers =
    event => ['altKey', 'ctrlKey', 'shiftKey'].filter(m => event[m]).map(m => m[0].toUpperCase() + m.slice(1, -3));
