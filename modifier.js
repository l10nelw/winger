export const SEND  = 'Ctrl';
export const BRING = 'Shift';

//@ (Object) -> ([String])
export function get(event) {
    const modifiers = [];
    if (event.altKey)   modifiers.push('Alt');
    if (event.ctrlKey)  modifiers.push('Ctrl');
    if (event.shiftKey) modifiers.push('Shift');
    return modifiers;
}