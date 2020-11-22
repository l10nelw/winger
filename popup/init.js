import { getScrollbarWidth, hasClass, addClass, toggleClass } from '../utils.js';
import { $otherWindowsList, $toolbar, unsetActionAttr } from './popup.js';
import { $omnibox } from './omnibox.js';
import * as Status from './status.js';
import * as Tooltip from './tooltip.js';
import * as Modifier from '../modifier.js';

const $currentWindowList = document.getElementById('currentWindow');

export default async function init() {
    const { SETTINGS, metaWindows, selectedTabCount } = await browser.runtime.sendMessage({ popup: true });

    row.removeCells(SETTINGS);
    toolbar.removeButtons(SETTINGS);

    populate(metaWindows);
    const $currentWindowRow = $currentWindowList.firstElementChild;
    const $otherWindowRows = [...$otherWindowsList.children];
    const $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    const modifierHints = createModifierHints(selectedTabCount);

    Status.init($allWindowRows);
    Tooltip.init(selectedTabCount);
    indicateReopenTabs($currentWindowRow, $otherWindowRows);
    resizeBody(row.buttonCount);

    $omnibox.hidden = false;
    $otherWindowsList.hidden = false;
    $toolbar.hidden = false;

    $omnibox.focus();
    alignWithScrollbar($currentWindowRow, $otherWindowsList);
    lockHeight($otherWindowsList);

    return {
        SETTINGS,
        $currentWindowRow,
        $otherWindowRows,
        $allWindowRows,
        modifierHints,
    };
}

function populate(metaWindows) {
    const currentMetaWindow = metaWindows.shift();
    $currentWindowList.appendChild(row.create(currentMetaWindow, true));
    for (const metaWindow of metaWindows) {
        $otherWindowsList.appendChild(row.create(metaWindow));
    }
}

const row = {

    $template: document.getElementById('rowTemplate').content.firstElementChild,
    cellSelectors: new Set(['.send', '.bring', '.input', '.tabCount', '.edit']),
    buttonCount: 0,

    removeCells(SETTINGS) {
        const cellMap = {
            // setting:       selector
            show_popup_bring: '.bring',
            show_popup_send:  '.send',
            show_popup_edit:  '.edit',
        };
        for (const [cell, selector] of Object.entries(cellMap)) {
            if (SETTINGS[cell]) {
                this.buttonCount++;
            } else {
                this.$template.querySelector(selector).remove();
                this.cellSelectors.delete(selector);
            }
        }
    },

    create({ id, incognito, givenName, defaultName }, isCurrent) {
        const $row = document.importNode(this.$template, true);

        // Add references to row's cells, and in each, a reference to the row
        for (const selector of this.cellSelectors) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
            if (isCurrent && hasClass('tabAction', $cell)) this.disableElement($cell);
        }

        // Add data
        if (isCurrent) {
            $row.classList.replace('otherRow', 'currentRow');
            this.disableElement($row);
        }
        $row._id = id;
        $row.$input.value = givenName;
        $row.$input.placeholder = defaultName;
        toggleClass('private', $row, incognito);

        return $row;
    },

    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        $el.title = '';
        unsetActionAttr($el);
    },

};

const toolbar = {
    removeButtons(SETTINGS) {
        const buttonMap = {
            // setting:          selector
            show_popup_help:     '#help',
            show_popup_settings: '#settings',
        }
        for (const [button, selector] of Object.entries(buttonMap)) {
            if (!SETTINGS[button]) $toolbar.querySelector(selector).remove();
        }
    },
};

function createModifierHints(selectedTabCount) {
    const { BRING, SEND } = Modifier;
    const tabWord = selectedTabCount === 1 ? 'tab' : 'tabs';
    return {
        [BRING]: `${BRING.toUpperCase()}: Bring ${tabWord} to...`,
        [SEND]:  `${SEND.toUpperCase()}: Send ${tabWord} to...`,
    };
}

function indicateReopenTabs($currentWindowRow, $otherWindowRows) {
    const isPrivate = $row => hasClass('private', $row);
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentIsPrivate) addClass('reopenTabs', $row);
    }
}

function resizeBody(buttonCount) {
    if (!buttonCount) return;
    const $document = document.documentElement;
    const styles = getComputedStyle($document);
    const buttonWidth = parseInt(styles.getPropertyValue('--width-btn'));
    const bodyWidth = parseInt(styles.getPropertyValue('--width-body'));
    const newBodyWidth = bodyWidth + buttonWidth * buttonCount;
    $document.style.setProperty('--width-body', `${newBodyWidth}px`);
};

function alignWithScrollbar($toAlign, $scrolling) {
    const scrollbarWidth = getScrollbarWidth($scrolling);
    if (!scrollbarWidth) return;
    document.styleSheets[0].insertRule(`.scrollbarOffset { margin-right: ${scrollbarWidth}px }`);
    addClass('scrollbarOffset', $toAlign);
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
