import { hasClass, addClass, changeClass, toggleClass, isButton } from '../utils.js';
import * as Popup from './popup.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Tooltip from './tooltip.js';

// Mutated by removeElements(), used by createRow()
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const rowElementSelectors = new Set(['.send', '.bring', '.input', '.tabCount', '.edit']);

const $body = document.body;

export default async function init() {
    const { SETTINGS, metaWindows, currentWindowId, sortedWindowIds, selectedTabCount } =
        await browser.runtime.sendMessage({ popup: true });

    removeElements(SETTINGS);
    const [$currentWindow, $otherWindows] = populate(metaWindows, currentWindowId, sortedWindowIds);
    const $currentWindowRow = $currentWindow.querySelector('li');
    const $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    const $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    const modifierHints = createModifierHints(SETTINGS, selectedTabCount);

    Count.init($allWindowRows);
    Tooltip.init(selectedTabCount);
    indicateReopenTabs($currentWindowRow, $otherWindowRows);
    lockHeight($otherWindows);

    return { SETTINGS, $currentWindowRow, $otherWindowRows, $allWindowRows, modifierHints };
}

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
        if ($parent === $rowTemplate) {
            rowElementSelectors.delete(selector);
            if (isButton($el)) popupWidth -= buttonWidth; // Reduce popup width if a row button is removed
        }
    }
    $document.style.setProperty('--width-body-rem', popupWidth);
}

function populate(metaWindows, currentWindowId, sortedWindowIds) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows  = document.getElementById('otherWindows');
    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        if (windowId == currentWindowId) {
            changeClass('otherRow', 'currentRow', $row);
            [$row, $row.$bring, $row.$send].forEach(Popup.unsetActionAttr);
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
    toggleClass('private', $row, incognito);

    return $row;
}

function createModifierHints(SETTINGS, selectedTabCount) {
    const { bring_modifier, send_modifier } = SETTINGS;
    const tabWord = selectedTabCount === 1 ? 'tab' : 'tabs';
    return {
        [bring_modifier]: `${bring_modifier.toUpperCase()}: Bring ${tabWord} to...`,
        [send_modifier]:  `${send_modifier.toUpperCase()}: Send ${tabWord} to...`,
    };
}

function indicateReopenTabs($currentWindowRow, $otherWindowRows) {
    const isPrivate = $row => hasClass('private', $row);
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentIsPrivate) addClass('reopenTabs', $row);
    }
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}