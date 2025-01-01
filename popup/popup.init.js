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

const popupStashResponse = Request.popupStash();
Request.popup().then(initPopup).catch(onError);

//@ ({ Object, [Object], Object }) -> state
async function initPopup({ fgWinfo, bgWinfos, flags }) {
    Object.assign(FLAGS, flags);

    const hasName = fgWinfo.givenName || bgWinfos.find(winfo => winfo.givenName);
    $body.classList.toggle('nameless', !hasName);

    Status.init(fgWinfo, bgWinfos);
    Omnibox.init();

    addWindowRows(fgWinfo, bgWinfos);
    // If omnibox has text, respond now
    if ($omnibox.value)
        Omnibox.handleInput({ target: $omnibox, inputType: '' });

    await popupStashResponse.then(addStashRows);
    // Check omnibox and respond again, without command autocompletion (already done at first response)
    if ($omnibox.value)
        Omnibox.handleInput({ target: $omnibox, inputType: '', _noAutocomplete: true });
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
function addWindowRows(fgWinfo, bgWinfos) {
    Row.initCurrent();
    const $minimizedHeading = document.getElementById('minimizedHeading');
    const currentIncognito = fgWinfo.incognito;
    const $rows = [];
    const $rowsFragment = document.createDocumentFragment();

    // Create other-rows (by cloning current-row)
    for (const winfo of bgWinfos) {
        const $row = Row.createOther(winfo, currentIncognito);
        $rows.push($row);
        $rowsFragment.appendChild($row);
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate current-row only after all other-rows have been created
    Row.hydrateCurrent($currentWindowRow, fgWinfo);

    // Hydrate $otherWindowRows and Filter.$shownRows
    const $firstMinimizedRow = $otherWindowsList.querySelector('.minimized');
    $firstMinimizedRow ?
        $firstMinimizedRow.insertAdjacentElement('beforebegin', $minimizedHeading) :
        $otherWindowsList.appendChild($minimizedHeading);
    $otherWindowRows.$minimizedHeading = $minimizedHeading;
    $otherWindowRows.$withHeadings = [...$otherWindowsList.children];
    $otherWindowRows.push(...$rows);
    Filter.$shownRows.push(...$rows);
    $names.push($currentWindowRow.$name, ...$rows.map($row => $row.$name));
}

//@ ([Object]) -> state
async function addStashRows(folders) {
    const $stashedHeading = document.getElementById('stashedHeading');
    $otherWindowsList.appendChild($stashedHeading);

    if (!folders?.length)
        return;

    // Modify $rowTemplate for stashed rows
    Row.$rowTemplate.hidden = $otherWindowsList.classList.contains('filtered');
    Row.$rowTemplate.querySelector('.name').placeholder = '(no title)';
    if (Row.CELL_SELECTORS.delete('.bring'))
        Row.disableElement(Row.$rowTemplate.querySelector('.bring'));

    const $rows = [];
    const $rowsFragment = document.createDocumentFragment();
    for (let folder of folders) {
        const $row = Row.createStashed(folder);
        $rows.push($row);
        $rowsFragment.appendChild($row);
        folder = { id: folder.id }; // Strip down folder objects for Request.popupStashContents()
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate tab counts
    folders = await Request.popupStashContents(folders);
    folders.forEach((folder, i) => $rows[i].$tabCount.textContent = folder.bookmarkCount);

    // Hydrate $otherWindowRows and Filter.$shownRows
    $otherWindowRows.$stashedHeading = $stashedHeading;
    $otherWindowRows.$withHeadings.push($stashedHeading, ...$rows);
    $otherWindowRows.push(...$rows);
    Filter.$shownRows.push(...$rows);
    $names.push(...$rows.map($row => $row.$name));
}

const Row = {

    CELL_SELECTORS: new Set(['.send', '.bring', '.name', '.tabCount', '.stash']),
    $rowTemplate: null,

    //@ (Object) -> state
    initCurrent() {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
            ['show_popup_stash', '.stash'],
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
            document.documentElement.style.setProperty('--popup-row-button-count', buttonCount);
        // Init $rowTemplate
        Row.$rowTemplate = $currentWindowRow.cloneNode(true);
    },

    //@ (Object, Boolean) -> (Object)
    createOther(winfo, currentIncognito) {
        const $row = Row.$rowTemplate.cloneNode(true);
        Row.hydrate($row, winfo);
        // Disable send/bring/stash buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('button').forEach(Row.disableElement);
            $row.classList.add('tabless');
        } else
        // Indicate if a send/bring action to this window will be a reopen operation
        if (winfo.incognito != currentIncognito)
            $row.classList.add('reopenTabs');
        return $row;
    },

    //@ ({ String, String, Object }) -> (Object)
    createStashed({ givenName, id, protoWindow }) {
        const $row = Row.$rowTemplate.cloneNode(true);
        Row.referenceHydrate($row);
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.classList.add('stashed');
        $row.classList.toggle('private', protoWindow?.incognito ?? false);
        return $row;
    },

    //@ (Object, Object) -> state
    hydrateCurrent($row, winfo) {
        Row.hydrate($row, winfo);
        Row.disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(Row.disableElement);
        $row.$name.tabIndex = 0;
        $row.$name.title = '';
    },

    //@ (Object, { String, Number, Boolean, Boolean, Number, String, String }) -> state
    hydrate($row, { givenName, id, incognito, minimized, tabCount, title, titleSansName }) {
        Row.referenceHydrate($row);
        title = titleSansName || title || '';
        // Add data
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.$name.placeholder = title;
        $row.$name.title = title;
        $row.$tabCount.textContent = tabCount;
        $row.classList.toggle('minimized', minimized);
        $row.classList.toggle('private', incognito);
    },

    // Add references to row's cells, and in each cell a reference back to the row
    referenceHydrate($row) {
        for (const selector of Row.CELL_SELECTORS) {
            const $cell = $row.querySelector(selector);
            const reference = selector.replace('.', '$');
            $cell.$row = $row;
            $row[reference] = $cell;
        }
    },

    //@ (Object) -> state
    disableElement($el) {
        $el.disabled = true;
        $el.tabIndex = -1;
        $el.removeAttribute('data-action');
    },

}
