// Elements of the popup
export const $body = document.body;
export const $omnibox = document.getElementById('omnibox');
export const $otherWindowsList = document.getElementById('otherWindows');
export const $toolbar = $body.querySelector('footer');
export let $currentWindowRow, $otherWindowRows, $actions;

const ACTION_ATTR = 'data-action';

//@ ({ Object, [Object] }), state -> state
export function init(data) {
    ({ $currentWindowRow, $otherWindowRows } = data);
    $actions = $body.querySelectorAll(`[${ACTION_ATTR}]`);
}

// Action attribute utilities
export const getActionAttr = $el => $el?.getAttribute(ACTION_ATTR); //@ (Object) -> (String)
export const unsetActionAttr = $el => $el?.removeAttribute(ACTION_ATTR); //@ (Object) -> state

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
