import {
    init as initCommon,
    $omnibox,
    $otherWindowsList,
    $toolbar,
    getScrollbarWidth,
    unsetActionAttr,
} from './common.js';
import * as Theme from '../theme.js';
import * as Omnibox from './omnibox.js';
import * as Filter from './filter.js';
import * as Status from './status.js';
import * as Tooltip from './tooltip.js';
import * as Request from './request.js';
import { BRING, SEND } from '../modifier.js';

const $currentWindowList = document.getElementById('currentWindow');
const getTemplateContent = id => document.getElementById(id).content.firstElementChild; //@ (Number), state -> (Object)

export default () => Request.popup().then(onSuccess).catch(onError);


//@ ({ Object, [Object], Number }), state -> ({String}), state
function onSuccess({ SETTINGS, winfos, selectedTabCount }) {
    if (!SETTINGS.enable_stash) delete Omnibox.commands.stash;

    populate(winfos);
    const $currentWindowRow = $currentWindowList.firstElementChild;
    const $otherWindowRows = [...$otherWindowsList.children];
    initCommon({ $currentWindowRow, $otherWindowRows });

    Status.init([$currentWindowRow, ...$otherWindowRows]);
    Tooltip.init(selectedTabCount);
    Filter.init();
    indicateReopenTabs($currentWindowRow, $otherWindowRows);
    Theme.apply(SETTINGS.theme);

    $omnibox.hidden = false;
    $otherWindowsList.hidden = false;
    $toolbar.hidden = false;

    $omnibox.focus();
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

    const $restartBtn = getTemplateContent('restartTemplate');
    $restartBtn.onclick = () => browser.runtime.reload();
    $toolbar.innerHTML = '';
    $toolbar.appendChild($restartBtn);
    $toolbar.hidden = false;
}


//@ ([Object]) -> state
function populate(winfos) {
    // Current window
    const currentWinfo = winfos.shift();
    $currentWindowList.appendChild(row.create(currentWinfo, true));
    // Other windows
    const $fragment = document.createDocumentFragment();
    winfos.forEach((winfo, index) => {
        const $row = row.create(winfo);
        $row._index = index;
        $fragment.appendChild($row);
    });
    $otherWindowsList.appendChild($fragment);
}

const row = {

    $TEMPLATE: getTemplateContent('rowTemplate'),
    cellSelectors: new Set(['.send', '.bring', '.name', '.tabCount']),

    //@ ({ Number, Boolean, String, String }, Boolean) -> (Object)
    create({ id, incognito, givenName, defaultName }, isCurrent) {
        const $row = document.importNode(this.$TEMPLATE, true);

        // Add references to row's cells, and in each, a reference to the row
        for (const selector of this.cellSelectors) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
            if (isCurrent && $cell.classList.contains('tabAction'))
                this.disableElement($cell);
        }

        // Add data
        if (isCurrent) {
            $row.classList.replace('otherRow', 'currentRow');
            $row.$name.tabIndex = 0;
            this.disableElement($row);
        }
        $row._id = id;
        $row.$name.value = givenName;
        $row.$name.placeholder = defaultName;
        $row.classList.toggle('private', incognito);

        return $row;
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
    if (!scrollbarWidth) return;
    document.styleSheets[0].insertRule(`.scrollbarOffset { margin-right: ${scrollbarWidth}px }`);
    $toAlign.classList.add('scrollbarOffset');
}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
