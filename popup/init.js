import {
    init as initCommon,
    $otherWindowsList,
    $toolbar,
    getScrollbarWidth,
    unsetActionAttr,
} from './common.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Tooltip from './tooltip.js';
import * as Request from './request.js';
import { BRING, SEND } from '../modifier.js';

const $currentWindowRow = document.getElementById('currentWindow').firstElementChild;

export default () => Request.popup().then(onSuccess).catch(onError);


//@ ({ Object, [Object], Number }), state -> ({String}), state
function onSuccess({ SETTINGS, winfos, selectedTabCount }) {
    if (!SETTINGS.enable_stash)
        delete Omnibox.commands.stash;

    populate(winfos);
    const $otherWindowRows = [...$otherWindowsList.children];
    initCommon({ $currentWindowRow, $otherWindowRows });

    Status.init([$currentWindowRow, ...$otherWindowRows]);
    Tooltip.init(selectedTabCount);
    Filter.init();
    indicateReopenTabs($currentWindowRow, $otherWindowRows);

    $toolbar.hidden = false;
    alignWithScrollbar($currentWindowRow, $otherWindowsList);
    lockHeight($otherWindowsList);

    const modifierHints = createModifierHints(selectedTabCount);
    return { modifierHints };
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
        $el.title = '';
        unsetActionAttr($el);
    },

}

//@ (Number) -> ({String})
function createModifierHints(selectedTabCount) {
    const tabWord = selectedTabCount === 1 ? 'tab' : 'tabs';
    return {
        [BRING]: `${BRING.toUpperCase()}: Bring ${tabWord} to...`,
        [SEND]:  `${SEND.toUpperCase()}: Send ${tabWord} to...`,
    };
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

//@ (Object, Object) -> state | null
function alignWithScrollbar($toAlign, $scrolling) {
    const scrollbarWidth = getScrollbarWidth($scrolling);
    if (!scrollbarWidth)
        return;
    document.styleSheets[0].insertRule(`.scrollbarOffset { margin-right: ${scrollbarWidth}px }`);
    $toAlign.classList.add('scrollbarOffset');
}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
