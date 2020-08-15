import { getScrollbarWidth, hasClass, addClass, toggleClass } from '../utils.js';
import { $otherWindowsList, $toolbar, unsetActionAttr } from './popup.js';
import { $omnibox } from './omnibox.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Tooltip from './tooltip.js';

const $currentWindowList = document.getElementById('currentWindow');

export default async function init() {
    const { SETTINGS, metaWindows, currentWindowId, selectedTabCount } = await browser.runtime.sendMessage({ popup: true });

    row.removeElements(SETTINGS);
    toolbar.removeElements(SETTINGS);

    metaWindows.sort((a, b) => b.lastFocused - a.lastFocused);
    populate(metaWindows, currentWindowId);
    const $currentWindowRow = $currentWindowList.firstElementChild;
    const $otherWindowRows = [...$otherWindowsList.children];
    const $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    const modifierHints = createModifierHints(SETTINGS, selectedTabCount);

    Count.init($allWindowRows);
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

function populate(metaWindows, currentWindowId) {
    for (const metaWindow of metaWindows) {
        if (metaWindow.id === currentWindowId) {
            $currentWindowList.appendChild(row.create(metaWindow, true));
        } else {
            $otherWindowsList.appendChild(row.create(metaWindow));
        }
    }
}

const row = {

    $template: document.getElementById('rowTemplate').content.firstElementChild,
    elementSelectors: new Set(['.send', '.bring', '.input', '.tabCount', '.edit']),
    buttonCount: 0,

    removeElements(SETTINGS) {
        const elements = {
            // setting:  selector
            popup_bring: '.bring',
            popup_send:  '.send',
            popup_edit:  '.edit',
        };
        for (const [element, selector] of Object.entries(elements)) {
            if (SETTINGS[element]) {
                this.buttonCount++;
            } else {
                this.$template.querySelector(selector).remove();
                this.elementSelectors.delete(selector);
            }
        }
    },

    create({ id, incognito, givenName, defaultName }, isCurrent) {
        const $row = document.importNode(this.$template, true);

        // Add references to row elements, and in each, a reference to the row
        for (const selector of this.elementSelectors) {
            const $el = $row.querySelector(selector);
            if (isCurrent && hasClass('tabAction', $el)) {
                this.disableElement($el);
                continue;
            }
            const property = selector.replace('.', '$');
            $el.$row = $row;
            $row[property] = $el;
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
    removeElements(SETTINGS) {
        const elements = {
            // setting:     selector
            popup_help:     '#help',
            popup_settings: '#settings',
        }
        for (const [element, selector] of Object.entries(elements)) {
            if (!SETTINGS[element]) $toolbar.querySelector(selector).remove();
        }
    },
};

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
