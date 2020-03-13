export const sum = array => array.reduce((a, b) => a + b, 0);

// Return array of active modifiers in the form of ['Alt', 'Ctrl', 'Shift'], or parts thereof, or [].
export const getModifiers =
    event => ['altKey', 'ctrlKey', 'shiftKey'].filter(m => event[m]).map(m => m[0].toUpperCase() + m.slice(1, -3));

// Forgiving* shorthands for element class methods. (*Silently does nothing if $el is undefined)
export const hasClass = (cls, $el) => $el && $el.classList.contains(cls);
export const addClass = (cls, $el) => $el && $el.classList.add(cls);
export const changeClass = (clsA, clsB, $el) => $el && $el.classList.replace(clsA, clsB);
export const toggleClass = (cls, $el, force) => $el && $el.classList.toggle(cls, force);
