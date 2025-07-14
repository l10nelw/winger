import { NameMap } from '../name.js';

/** @typedef {import('../types.js').WindowId} WindowId */
/** @typedef {import('../types.js').BNodeId} FolderId */
/** @typedef {import('../types.js').Winfo} Winfo */
/** @import { STORED_PROPS } from '../storage.js' */

/**
 * @typedef WindowRow$Properties
 * @property {WindowId | FolderId} _id
 * @property {number} [_nameLength]
 * @property {NameField$} $name
 * @property {HTMLElement} $tabCount
 */
/** @typedef {HTMLLIElement & WindowRow$Properties} WindowRow$ - Window row element */
/** @typedef {HTMLInputElement & { _id: WindowId | FolderId }} NameField$ - Name field element */

// Elements of the popup //

/** @type {HTMLBodyElement} */ export const $body = document.body;
/** @type {WindowRow$} */ export const $currentWindowRow = document.getElementById('currentWindow').firstElementChild;
/** @type {HTMLInputElement} */ export const $omnibox = document.getElementById('omnibox');
/** @type {HTMLUListElement} */ export const $otherWindowsList = document.getElementById('otherWindows');
/** @type {HTMLElement} */ export const $toolbar = $body.querySelector('footer');
/** @type {HTMLElement} */ export const $status = document.getElementById('status');

// Populated at init //

/** @type {Partial<STORED_PROPS>} */ export const FLAGS = {};

/** @type {NameField$[] & { $stashed: NameField$[] & { _startIndex: number } }} */
export const $names = [];

/**
 * Original order of only window rows, unlike `$otherWindowsList.children` whose order can change and may contain heading rows.
 * `$withHeadings` has all rows in original order.
 * @type {WindowRow$[] & {
 *     $minimizedHeading: HTMLLIElement, $withHeadings: HTMLLIElement[],
 *     $stashedHeading?: HTMLLIElement, $stashed?: WindowRow$[] & { _startIndex: number },
 * }}
 */
export const $otherWindowRows = [];

// Element type //

/** @param {HTMLElement?} $el @returns {boolean} */ export const isButton = $el => $el?.tagName === 'BUTTON';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isField = $el => $el?.tagName === 'INPUT';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isNameField = $el => $el?.classList.contains('name');
/** @param {HTMLElement?} $el @returns {boolean} */ export const isRow = $el => $el?.tagName === 'LI';
/** @param {HTMLElement?} $el @returns {boolean} */ export const isInToolbar = $el => $el?.parentElement === $toolbar;

// Name map //

/** @type {NameMap & { ready: () => NameMap }} */
export const nameMap = new NameMap();
nameMap.ready = () => nameMap.size ? nameMap : nameMap.populate($names);
