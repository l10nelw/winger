import {
    FLAGS,
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

Request.popup().then(onSuccess).catch(onError);

//@ ({ Object, [Object], Object }) -> state
function onSuccess({ currentWinfo, otherWinfos, flags }) {
    Object.assign(FLAGS, flags);

    const hasName = currentWinfo.givenName || otherWinfos.find(winfo => winfo.givenName);
    $body.classList.toggle('nameless', !hasName);

    addRows(currentWinfo, otherWinfos);
    $names.push(...$body.querySelectorAll('.name'));

    Omnibox.init();
    Filter.init();
    Status.init(currentWinfo, otherWinfos);

    lockHeight($otherWindowsList);
}

//@ -> state
function onError() {
    Request.debug();
    Request.showWarningBadge();

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


// Populate $otherWindowsList and $otherWindowRows with rows
//@ (Object, [Object], Object) -> state
function addRows(currentWinfo, otherWinfos) {
    Row.initCurrent();
    const currentIncognito = currentWinfo.incognito;
    const $rowsFragment = document.createDocumentFragment();
    let $minHeading = $otherWindowsList.firstElementChild; // "---Minimized---"
    let minHeadingIndex = -1, index = 0;
    // Create other-rows (by cloning current-row), and set minHeadingIndex to index of first minimized row
    for (const winfo of otherWinfos) {
        if (minHeadingIndex === -1 && winfo.minimized)
            minHeadingIndex = index;
        $rowsFragment.appendChild(Row.createOther(winfo, currentIncognito));
        index++;
    }
    $otherWindowsList.appendChild($rowsFragment);
    // Hydrate current-row only after all other-rows have been created
    Row.hydrateCurrent($currentWindowRow, currentWinfo);

    // Populate $otherWindowRows
    if (minHeadingIndex === -1) {
        $minHeading.remove();
        $otherWindowRows.$minHeading = {};
    } else {
        const $elAfterHeading = minHeadingIndex
            ? $otherWindowsList.querySelector('.minimized') // Move to above the first minimized-row
            : $otherWindowsList; // Move outside and above the list
        $elAfterHeading.insertAdjacentElement('beforebegin', $minHeading);
        $otherWindowRows.$minHeading = $minHeading;
        $minHeading.hidden = false;
    }
    const $otherRows = [...$otherWindowsList.children];
    $otherWindowRows.$withMinHeading = [...$otherRows]; // Has no minimized-heading if minHeadingIndex <= 0
    if (minHeadingIndex > 0)
        $otherRows.splice(minHeadingIndex, 1);
    $otherWindowRows.push(...$otherRows); // Always has no minimized-heading
}

const Row = {

    CELL_SELECTORS: new Set(['.send', '.bring', '.name', '.tabCount']),

    //@ (Object) -> state
    initCurrent() {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            const $button = $currentWindowRow.querySelector(selector);
            if (FLAGS[setting]) {
                $button.hidden = false;
            } else {
                $button.remove();
                Row.CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--button-count', buttonCount);
    },

    //@ (Object, Boolean) -> (Object)
    createOther(winfo, currentIncognito) {
        const $row = $currentWindowRow.cloneNode(true);
        Row.hydrate($row, winfo);
        // Disable tab action buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('.tabAction').forEach(Row.disableElement);
            $row.classList.add('tabless');
        } else
        // Indicate if a send/bring action to this window will be a reopen operation
        if (winfo.incognito != currentIncognito)
            $row.classList.add('reopenTabs');
        return $row;
    },

    //@ (Object, Object) -> state
    hydrateCurrent($row, winfo) {
        Row.hydrate($row, winfo);
        Row.disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(Row.disableElement);
        $row.$name.tabIndex = 0;
    },

    //@ (Object, { String, Number, Boolean, Boolean, Number, String, String }) -> state
    hydrate($row, { givenName, id, incognito, minimized, tabCount, title, titleSansName }) {
        // Add references to row's cells, and in each cell a reference back to the row
        for (const selector of Row.CELL_SELECTORS) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
        }
        // Add data
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.$name.title = titleSansName || title || '';
        if (titleSansName)
            $row.$name.placeholder = titleSansName;
        $row.$tabCount.textContent = tabCount;
        $row.classList.toggle('minimized', minimized);
        $row.classList.toggle('private', incognito);
    },

    //@ (Object) -> state
    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        $el.removeAttribute('data-action');
    },

}

//@ (Object) -> state
function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}
