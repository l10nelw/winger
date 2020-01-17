export function hasClass($el, cls) {
    return $el.classList.contains(cls);
}

export function sum(array) {
    return array.reduce((a, b) => a + b, 0);
}