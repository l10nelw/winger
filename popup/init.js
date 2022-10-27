import {
    init as initCommon,
    $otherWindowsList,
    $toolbar,
    unsetActionAttr,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Request from './request.js';

const $currentWindowRow = document.getElementById('currentWindow').firstElementChild;

Request.popup().then(onSuccess).catch(onError);


//@ ({ [Object], Number, Boolean }) -> state
function onSuccess({ winfos, selectedTabCount, stashEnabled }) {
    populate(winfos);
    const $otherWindowRows = [...$otherWindowsList.children];
    initCommon({ $currentWindowRow, $otherWindowRows });

    Omnibox.init(selectedTabCount, stashEnabled);
    Status.init([$currentWindowRow, ...$otherWindowRows]);
    Filter.init();
    indicateReopenTabs($currentWindowRow, $otherWindowRows);

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


//@ ([Object]) -> state
function populate(winfos) {
    const currentWinfo = winfos.shift();

    // Other windows
    const $fragment = document.createDocumentFragment();
    winfos.forEach((winfo, index) => {
        const $row = row.createOther(winfo);
        $row._index = index; // Used by navigation.js restrictScroll()
        $fragment.appendChild($row);
    });
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

    //@ (Object, { Number, Boolean, String, String }) -> state
    hydrate($row, { id, incognito, givenName, defaultName }) {
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
        $row.$name.placeholder = defaultName;
        $row.classList.toggle('private', incognito);
    },

    //@ (Object) -> state
    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        unsetActionAttr($el);
    },

}

const isPrivate = $row => $row.classList.contains('private'); //@ (Object) -> (Boolean)

//@ (Object, [Object]) -> state
function indicateReopenTabs($currentWindowRow, $otherWindowRows) {
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
