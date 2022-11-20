import {
    $currentWindowRow,
    $otherWindowRows,
    $otherWindowsList,
    $toolbar,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Request from './request.js';
import { NO_NAME } from '../background/name.js';

Request.popup().then(onSuccess).catch(onError);


//@ ({ Object, [Object], Number, Boolean }) -> state
function onSuccess({ currentWinfo, otherWinfos, selectedTabCount, stashEnabled }) {
    populate(currentWinfo, otherWinfos);
    $otherWindowRows.push(...$otherWindowsList.children);
    Object.freeze($otherWindowRows);

    Omnibox.init(selectedTabCount, stashEnabled);
    Status.init([$currentWindowRow, ...$otherWindowRows]);
    Filter.init();
    indicateReopenTabs();

    $toolbar.hidden = false;
    lockHeight($otherWindowsList);
}

//@ -> state
function onError() {
    Request.debug();

    browser.browserAction.setBadgeText({ text: '⚠️' });
    browser.browserAction.setBadgeBackgroundColor({ color: 'transparent' });
    Status.show('⚠️ Winger needs to be restarted.');

    const $restartBtn = document.getElementById('restartTemplate').content.firstElementChild;
    $restartBtn.onclick = () => browser.runtime.reload();
    $toolbar.innerHTML = '';
    $toolbar.appendChild($restartBtn);
    $toolbar.hidden = false;
}


//@ (Object, [Object]) -> state
function populate(currentWinfo, otherWinfos) {
    // Create other-rows
    const $fragment = document.createDocumentFragment();
    for (const winfo of otherWinfos)
        $fragment.appendChild(row.createOther(winfo));
    $otherWindowsList.appendChild($fragment);

    // Hydrate current-row only after all other-rows have been created
    row.hydrateCurrent($currentWindowRow, currentWinfo);
}

const row = {

    CELL_SELECTORS: ['.send', '.bring', '.name', '.tabCount'],

    //@ (Object, Object) -> (Object)
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

    //@ (Object, { Number, Boolean, String }) -> state
    hydrate($row, { id, incognito, givenName }) {
        // Add references to row's cells, and in each cell a reference back to the row
        for (const selector of this.CELL_SELECTORS) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
        }
        // Add data
        $row._id = id;
        $row.$name.value = givenName;
        $row.$name.placeholder = NO_NAME;
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
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentIsPrivate)
            $row.classList.add('reopenTabs');
    }
}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
