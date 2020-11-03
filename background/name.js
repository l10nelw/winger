// const defaultPattern = /^Window \d+$/;
const numberPostfix = / (\d+)$/;

// Add " 2" at the end of str, or increment an existing " number".
export function applyNumberPostfix(str) {
    const found = str.match(numberPostfix);
    return found
        ? `${str.slice(0, found.index)} ${parseInt(found[1]) + 1}`
        : str + ` 2`;
}

// Remove spaces and illegal characters from str.
export function fix(str) {
    str = str.trim();
    return str.startsWith('/') ? fix(str.slice(1)) : str;
}