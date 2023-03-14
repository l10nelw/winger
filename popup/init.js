import {
    $body,
    $currentWindowRow,
    $omnibox,
    $otherWindowsList,
    $otherWindowRows,
    $names,
    $toolbar,
    $status,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Request from './request.js';
import { NO_NAME } from '../name.js';

Request.popup().then(onSuccess).catch(onError);

//@ ({ Object, [Object], Object }) -> state
function onSuccess({ currentWinfo, otherWinfos, settings }) {
    markReopen(otherWinfos, currentWinfo.incognito);
    populate(currentWinfo, otherWinfos, settings);
    $otherWindowRows.push(...$otherWindowsList.children);
    $names.push(...$body.querySelectorAll('.name'));

    Omnibox.init(settings);
    Status.init(currentWinfo, otherWinfos, settings);
    Filter.init();
    indicateReopenTabs();
    lockHeight($otherWindowsList);
}

//@ -> state
function onError() {
    Request.debug();

    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });

    $currentWindowRow.hidden = true;
    $omnibox.hidden = true;
    $otherWindowsList.hidden = true;

    $status.textContent = 'Close and try again. If issue persists, restart Winger.';
    $toolbar.querySelectorAll('button').forEach($button => $button.remove());
    const $restartBtn = document.getElementById('restartTemplate').content.firstElementChild;
    $toolbar.appendChild($restartBtn);
    $restartBtn.onclick = () => browser.runtime.reload();
    $restartBtn.focus();
}


// Add reopen property to other-winfos that do not share the same private status as the current-winfo.
// Indicates that a send/bring action to the other-window will be a reopen operation.
//@ ([Object], Boolean) -> state
function markReopen(otherWinfos, isCurrentIncognito) {
    for (const winfo of otherWinfos)
        winfo.reopen = winfo.incognito !== isCurrentIncognito;
}

//@ (Object, [Object], Object) -> state
function populate(currentWinfo, otherWinfos, settings) {
    Row.initCurrent(settings);

    // Create other-rows by cloning current-row
    const $fragment = document.createDocumentFragment();
    for (const winfo of otherWinfos)
        $fragment.appendChild(Row.createOther(winfo));
    $otherWindowsList.appendChild($fragment);

    // Hydrate current-row only after all other-rows have been created
    Row.hydrateCurrent($currentWindowRow, currentWinfo);
}

const Row = {

    CELL_SELECTORS: new Set(['.send', '.bring', '.name', '.tabCount']),

    //@ (Object) -> state
    initCurrent(settings) {
        $currentWindowRow.querySelector('.name').placeholder = NO_NAME;

        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            const $button = $currentWindowRow.querySelector(selector);
            if (settings[setting]) {
                $button.hidden = false;
            } else {
                $button.remove();
                this.CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--button-count', buttonCount);
    },

    //@ (Object) -> (Object)
    createOther(winfo) {
        const $row = $currentWindowRow.cloneNode(true);
        this.hydrate($row, winfo);
        return $row;
    },

    //@ (Object, Object) -> state
    hydrateCurrent($row, winfo) {
        this.hydrate($row, winfo);
        $row.$name.tabIndex = 0;
        this.disableElement($row);
        $row.querySelectorAll('.tabAction').forEach($button => this.disableElement($button));
    },

    //@ (Object, { Number, Boolean, String, Number }) -> state
    hydrate($row, { id, incognito, givenName, tabCount }) {
        // Add references to row's cells, and in each cell a reference back to the row
        for (const selector of this.CELL_SELECTORS) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
        }
        // Add data
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.$tabCount.textContent = tabCount;
        $row.classList.toggle('private', incognito);
    },

    //@ (Object) -> state
    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        $el.removeAttribute('data-action');
    },

}

const isPrivate = $row => $row.classList.contains('private'); //@ (Object) -> (Boolean)

//@ state -> state
function indicateReopenTabs() {
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows)
        if (isPrivate($row) != currentIsPrivate)
            $row.classList.add('reopenTabs');
}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
