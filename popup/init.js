import { hasClass, addClass, toggleClass } from '../utils.js';
import { init as initCommon, $otherWindowsList, $toolbar, getScrollbarWidth, unsetActionAttr } from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Tooltip from './tooltip.js';
import * as Request from './request.js';
import { BRING, SEND } from '../modifier.js';

const { $omnibox } = Omnibox;
const $currentWindowList = document.getElementById('currentWindow');
const getTemplateContent = id => document.getElementById(id).content.firstElementChild;

export default () => Request.popup().then(onSuccess).catch(onError);


function onSuccess({ SETTINGS, winfos, selectedTabCount }) {
    row.removeCells(SETTINGS);
    toolbar.removeButtons(SETTINGS);
    if (SETTINGS.enable_stash) {
        Omnibox.commands.stash = Request.stash;
    }

    populate(winfos);
    const $currentWindowRow = $currentWindowList.firstElementChild;
    const $otherWindowRows = [...$otherWindowsList.children];
    const $allWindowRows = [$currentWindowRow, ...$otherWindowRows];
    initCommon({ $currentWindowRow, $otherWindowRows, $allWindowRows });

    Status.init($allWindowRows);
    Tooltip.init(selectedTabCount);
    Filter.init();
    indicateReopenTabs($currentWindowRow, $otherWindowRows);
    expandBodyWidth(row.buttonCount);

    $omnibox.hidden = false;
    $otherWindowsList.hidden = false;
    $toolbar.hidden = false;

    $omnibox.focus();
    alignWithScrollbar($currentWindowRow, $otherWindowsList);
    lockHeight($otherWindowsList);

    const modifierHints = createModifierHints(selectedTabCount);
    return { modifierHints };
}

function onError() {
    Request.debug();

    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });

    Status.show('⚠️ Winger needs to be restarted.');
    expandBodyWidth(1);

    const $restartBtn = getTemplateContent('restartTemplate');
    $restartBtn.onclick = () => browser.runtime.reload();
    $toolbar.innerHTML = '';
    $toolbar.appendChild($restartBtn);
    $toolbar.hidden = false;
    expandBodyWidth(1);

    Status.show('⚠️ Winger needs to be restarted.');
}


function populate(winfos) {
    const currentWinfo = winfos.shift();
    $currentWindowList.appendChild(row.create(currentWinfo, true));
    for (const winfo of winfos) {
        $otherWindowsList.appendChild(row.create(winfo));
    }
}

const row = {

    $template: getTemplateContent('rowTemplate'),
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

}

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
}

function createModifierHints(selectedTabCount) {
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

function expandBodyWidth(buttonCount) {
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
