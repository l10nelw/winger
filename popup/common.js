import { hasClass } from '../utils.js';

// Elements of the popup
export const $body = document.body;
export const $omnibox = document.getElementById('omnibox');
export const $otherWindowsList = document.getElementById('otherWindows');
export const $toolbar = $body.querySelector('footer');
export let $currentWindowRow, $otherWindowRows;

export function init(data) {
    ({ $currentWindowRow, $otherWindowRows } = data);
}

// Element type
export const isButton = $el => $el?.tagName === 'BUTTON';
export const isInput = $el => $el?.tagName === 'INPUT';
export const isRow = $el => $el?._id;

// Action attribute utilities
const actionAttr = 'data-action';
export const getActionAttr = $el => $el?.getAttribute(actionAttr);
export const unsetActionAttr = $el => $el?.removeAttribute(actionAttr);
export const getActionElements = ($scope = $body, suffix = '') => $scope.querySelectorAll(`[${actionAttr}]${suffix}`);

// Given a $row or any of its child elements, get the givenName or defaultName.
export function getName($rowElement) {
    const $name = hasClass('name', $rowElement) && $rowElement || $rowElement.$name || $rowElement.$row.$name;
    return $name.value || $name.placeholder;
}

export const getScrollbarWidth = $el => $el.offsetWidth - $el.clientWidth;
