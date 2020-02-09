export const sum = array => array.reduce((a, b) => a + b, 0);

export const end = sequence => sequence[sequence.length - 1];

// Return array of active modifiers in the form of ['Alt', 'Ctrl', 'Shift'] or parts thereof or [].
export const getModifiers =
    event => ['altKey', 'ctrlKey', 'shiftKey'].filter(m => event[m]).map(m => m[0].toUpperCase() + m.slice(1, -3));

// Forgiving* shorthands for $element.classList methods.
// *Silently does nothing if $element does not exist.
export const hasClass = (cls, $element) => $element && $element.classList.contains(cls);
export const changeClass = (clsA, clsB, $element) => $element && $element.classList.replace(clsA, clsB);
