import { hasClass, addClass, changeClass, toggleClass } from '../utils.js';
import { $currentWindowList, $otherWindowsList, $footer, unsetActionAttr } from './popup.js';
import { $omnibox } from './omnibox.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Tooltip from './tooltip.js';

export default async function init() {
    const { SETTINGS, metaWindows, currentWindowId, sortedWindowIds, selectedTabCount } =
        await browser.runtime.sendMessage({ popup: true });

    removeElements(SETTINGS);
    populate(metaWindows, currentWindowId, sortedWindowIds);
    const $currentWindowRow = $currentWindowList.firstElementChild;
    const $otherWindowRows = [...$otherWindowsList.children];
    const $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    const modifierHints = createModifierHints(SETTINGS, selectedTabCount);

    Count.init($allWindowRows);
    Tooltip.init(selectedTabCount);
    indicateReopenTabs($currentWindowRow, $otherWindowRows);

    $omnibox.hidden = false;
    $otherWindowsList.hidden = false;
    $footer.hidden = false;

    $omnibox.focus();
    alignWithScrollbar($currentWindowList, $otherWindowsList);
    lockHeight($otherWindowsList);

    return {
        SETTINGS,
        $currentWindowRow,
        $otherWindowRows,
        $allWindowRows,
        modifierHints,
    };
}

// Mutated by removeElements(), used by createRow()
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const rowElementSelectors = new Set(['.send', '.bring', '.input', '.tabCount', '.edit']);

function removeElements(SETTINGS) {
    const elements = {
        // SETTINGS_key: [$scope, selector]
        popup_bring:     [$rowTemplate, '.bring'],
        popup_send:      [$rowTemplate, '.send'],
        popup_edit:      [$rowTemplate, '.edit'],
        popup_help:      [$footer, '#help'],
        popup_settings:  [$footer, '#settings'],
    }
    for (const element in elements) {
        if (SETTINGS[element]) continue; // If element enabled, leave it alone
        const [$scope, selector] = elements[element];
        $scope.querySelector(selector).remove();
        rowElementSelectors.delete(selector);
    }
}

function populate(metaWindows, currentWindowId, sortedWindowIds) {
    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        if (windowId === currentWindowId) {
            $currentWindowList.appendChild(createRow(metaWindow, true));
        } else {
            $otherWindowsList.appendChild(createRow(metaWindow));
        }
    }
}

function createRow({ id, incognito, givenName, defaultName }, isCurrent) {
    const $row = document.importNode($rowTemplate, true);

    // Add references to row elements, and in each, a reference to the row
    for (const selector of rowElementSelectors) {
        const $el = $row.querySelector(selector);
        if (isCurrent && hasClass('tabAction', $el)) {
            disableElement($el);
            continue;
        }
        const property = selector.replace('.', '$');
        $el.$row = $row;
        $row[property] = $el;
    }

    // Add data
    if (isCurrent) {
        changeClass('otherRow', 'currentRow', $row);
        disableElement($row);
    }
    $row._id = id;
    $row.$input.value = givenName;
    $row.$input.placeholder = defaultName;
    toggleClass('private', $row, incognito);

    return $row;
}

function disableElement($el) {
    $el.disabled = true;
    $el.tabIndex = -1;
    $el.title = '';
    unsetActionAttr($el);
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

function alignWithScrollbar($toAlign, $scrolling) {
    const scrollbarWidth = $scrolling.offsetWidth - $scrolling.clientWidth;
    if (scrollbarWidth) $toAlign.style.marginInlineEnd = `${scrollbarWidth}px`;
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
