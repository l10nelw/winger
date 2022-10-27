// Elements of the popup
export const $body = document.body;
export const $currentWindowRow = document.getElementById('currentWindow').firstElementChild;
export const $omnibox = document.getElementById('omnibox');
export const $otherWindowsList = document.getElementById('otherWindows');
export const $otherWindowRows = [];
export const $toolbar = $body.querySelector('footer');

// Element type
//@ (Object) -> (Boolean)
export const isButton = $el => $el?.tagName === 'BUTTON';
export const isField = $el => $el?.tagName === 'INPUT';
export const isNameField = $el => $el.classList.contains('name');
export const isRow = $el => $el?._id;

// Given a $row or any of its child elements, get the givenName or defaultName.
//@ (Object) -> (String)
export function getName($el) {
    const $name = isNameField($el) && $el || $el.$name || $el.$row.$name;
    return $name.value || $name.placeholder;
}
