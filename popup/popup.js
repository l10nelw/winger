/*
- A window is represented in the popup as a 'row', which is represented by a list item (<li>) in HTML.
- A variable prefixed with '$' references a DOM node or a collection of DOM nodes.
- All relevant metadata is embedded and updated within the popup's DOM structure. There is no separate,
  representative dataset to be managed in parallel with the DOM, apart from Metadata in the background.
*/

import { hasClass, addClass, changeClass, getModifiers } from '../utils.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Omnibox from './omnibox.js';
import * as EditMode from './editmode.js';

const $body = document.body;

// Mutated by removeElements(), used by createRow()
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const rowElementSelectors = new Set(['.send', '.bring', '.input', '.tabCount', '.edit']);

// Defined in init()
export let SETTINGS, $currentWindowRow, $otherWindowRows, $allWindowRows;
let modifierHints;

// Action attribute utilities
const actionAttr = 'data-action';
const getActionAttr = $el => $el && $el.getAttribute(actionAttr);
const unsetActionAttr = $el => $el && $el.removeAttribute(actionAttr);
export const getActionElements = ($scope, suffix = '') => $scope.querySelectorAll(`[${actionAttr}]${suffix}`);

// Request metadata from background for initialisation
browser.runtime.sendMessage({ popup: true }).then(init);

function init({ settings, metaWindows, currentWindowId, sortedWindowIds, selectedTabCount }) {
    SETTINGS = settings;
    removeElements(SETTINGS);
    setModifierHints(SETTINGS, selectedTabCount);

    const [$currentWindow, $otherWindows] = populateRows(metaWindows, currentWindowId, sortedWindowIds);
    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    Count.populate();
    indicateReopenTabs();
    initTooltips(selectedTabCount);
    lockHeight($otherWindows);

    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keydown', onKeyDown);
    $body.addEventListener('keyup', onKeyUp);

    function removeElements(SETTINGS) {
        const elements = {
            // Keys are from SETTINGS
            popup_bring:    [$rowTemplate, '.bring'],
            popup_send:     [$rowTemplate, '.send'],
            popup_edit:     [$rowTemplate, '.edit'],
            popup_help:     [$body, '#help'],
            popup_settings: [$body, '#settings'],
        }
        const $document = document.documentElement;
        const styles = getComputedStyle($document);
        const buttonWidth = styles.getPropertyValue('--width-btn-rem');
        let popupWidth = styles.getPropertyValue('--width-body-rem');

        for (const element in elements) {
            if (SETTINGS[element]) continue; // If element enabled, leave it alone
            const [$parent, selector] = elements[element];
            const $el = $parent.querySelector(selector);
            $el.remove();
            if ($parent == $rowTemplate) {
                rowElementSelectors.delete(selector);
                if ($el.tagName == 'BUTTON') popupWidth -= buttonWidth; // Reduce popup width if a row button is removed
            }
        }
        $document.style.setProperty('--width-body-rem', popupWidth);
    }

    function setModifierHints(SETTINGS, selectedTabCount) {
        const bringModifier = SETTINGS.bring_modifier;
        const sendModifier  = SETTINGS.send_modifier;
        const tabWord = selectedTabCount == 1 ? 'tab' : 'tabs';
        modifierHints = {
            [bringModifier]: `${bringModifier.toUpperCase()}: Bring ${tabWord} to`,
            [sendModifier]:  `${sendModifier.toUpperCase() }: Send ${tabWord} to`,
        };
    }

    function populateRows(metaWindows, currentWindowId, sortedWindowIds) {
        const $currentWindow = document.getElementById('currentWindow');
        const $otherWindows  = document.getElementById('otherWindows');
        for (const windowId of sortedWindowIds) {
            const metaWindow = metaWindows[windowId];
            const $row = createRow(metaWindow);
            if (windowId == currentWindowId) {
                changeClass('otherRow', 'currentRow', $row);
                [$row, $row.$bring, $row.$send].forEach(unsetActionAttr);
                $row.tabIndex = -1;
                $row.title = '';
                $currentWindow.appendChild($row);
            } else {
                $otherWindows.appendChild($row);
            }
        }
        return [$currentWindow, $otherWindows];
    }

    function createRow({ id, incognito, givenName, defaultName }) {
        const $row = document.importNode($rowTemplate, true);

        // Add references to row elements, and in each, a reference to the row
        rowElementSelectors.forEach(selector => {
            const $el = $row.querySelector(selector);
            const property = selector.replace('.', '$');
            $el.$row = $row;
            $row[property] = $el;
        });

        // Add data
        $row._id = id;
        $row.$input.value = givenName;
        $row.$input.placeholder = defaultName;
        if (incognito) addClass('private', $row);

        return $row;
    }

    function indicateReopenTabs() {
        const isPrivate = $row => hasClass('private', $row);
        const currentIsPrivate = isPrivate($currentWindowRow);
        for (const $row of $otherWindowRows) {
            if (isPrivate($row) != currentIsPrivate) addClass('reopenTabs', $row);
        }
    }

    function initTooltips(tabCount) {
        let rowNames = new Map();
        function memoisedRowName($row) {
            let name = rowNames.get($row);
            if (!name) {
                name = getDisplayName($row);
                rowNames.set($row, name);
            }
            return name;
        }
        const tabCountPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
        const reopenPhrase = $row => hasClass('reopenTabs', $row) ? '(reopen) ' : '';
        const $actions = getActionElements($body);
        for (const $action of $actions) {
            const $row = $action.$row || $action;
            const name = memoisedRowName($row);
            const insertText = reopenPhrase($row) + tabCountPhrase;
            $action.title = updateTooltipName($action.title, name).replace('#', insertText);
        }
    }

    function lockHeight($el) {
        $el.style.height = ``;
        $el.style.height = `${$el.offsetHeight}px`;
    }
}

// Add or change the name portion of a tooltip.
export function updateTooltipName(tooltip, name) {
    const colon = ': ';
    const colonIndex = tooltip.indexOf(colon);
    if (colonIndex > -1) {
        tooltip = tooltip.slice(0, colonIndex + colon.length) + name;
    }
    return tooltip;
}

export function openHelp() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function openSettings() {
    browser.runtime.openOptionsPage();
    window.close();
}

const uniqueBtnActions = { openHelp, openSettings };

function onClick(event) {
    const $target = event.target;
    const id = $target.id;
    if (id in uniqueBtnActions) uniqueBtnActions[id](); // Closes popup
    if (EditMode.handleClick($target)) return; // Handled by EditMode
    requestAction(event, $target);
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) event.preventDefault();
}

function onKeyDown(event) {
    if (!EditMode.$active) {
        let key = event.key;
        if (key === 'Control') key = 'Ctrl';
        Omnibox.info(modifierHints[key]);
    }
}

function onKeyUp(event) {
    const $target = event.target;
    if (!EditMode.$active) {
        Omnibox.info();
    }
    if ($target == Omnibox.$omnibox) {
        Omnibox.onKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        requestAction(event, $target);
    }
}

// Given a $row or any of its child elements, get the displayName.
export function getDisplayName($rowElement) {
    const $input = hasClass('input', $rowElement) && $rowElement || $rowElement.$input || $rowElement.$row.$input;
    return $input.value || $input.placeholder;
}

// Gather action parameters from event and $action element. If action and windowId found, send parameters to
// background to request action execution.
export function requestAction(event, $action = event.target) {
    const $row = $action.$row || $action;
    const windowId = $row._id;
    if (!windowId) return;
    const action = getActionAttr($action) || getActionAttr($row);
    if (!action) return;
    browser.runtime.sendMessage({
        action,
        windowId,
        reopen: hasClass('reopenTabs', $row),
        modifiers: getModifiers(event),
    });
    window.close();
}