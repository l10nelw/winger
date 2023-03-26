import { NameMap } from '../name.js';

// Elements of the popup
export const $body = document.body;
export const $currentWindowRow = document.getElementById('currentWindow').firstElementChild;
export const $omnibox = document.getElementById('omnibox');
export const $otherWindowsList = document.getElementById('otherWindows');
export const $otherWindowRows = []; // Original order of rows at init, unlike $otherWindowsList.children whose order can change
export const $names = []; // Populated at init
export const $toolbar = $body.querySelector('footer');
export const $status = document.getElementById('status');

// Element type
//@ (Object) -> (Boolean)
export const isButton = $el => $el?.tagName === 'BUTTON';
export const isField = $el => $el?.tagName === 'INPUT';
export const isNameField = $el => $el?.classList.contains('name');
export const isRow = $el => $el?.tagName === 'LI';
export const isInToolbar = $el => $el?.parentElement === $toolbar;

// Given a $row or any of its child elements, get the givenName.
//@ (Object) -> (String)
export function getName($el) {
    const $name = isNameField($el) && $el || $el.$name || $el.$row.$name;
    return $name.value;
}

export const nameMap = new NameMap();
nameMap.ready = () => nameMap.size ? nameMap : nameMap.bulkSet($names); //@ state -> (Map(Number:String)), state|nil