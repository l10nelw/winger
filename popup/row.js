import {
    FLAGS,
    $currentWindowRow,
    $otherWindowsList,
    $otherWindowRows,
    $names,
} from './common.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

const CELL_SELECTORS = new Set(['.send', '.bring', '.name', '.tabCount', '.stash']);
const Template = {};

//@ (Object, [Object], Object) -> state
export function addAllWindows(fgWinfo, bgWinfos) {
    WindowRow.init();
    const $minimizedHeading = document.getElementById('minimizedHeading');
    const currentIncognito = fgWinfo.incognito;
    const $rows = [];
    const $_names = [];
    const $rowsFragment = document.createDocumentFragment();

    // Create other-rows (by cloning current-row)
    for (const winfo of bgWinfos) {
        const $row = WindowRow.create(winfo, currentIncognito);
        $rows.push($row);
        $_names.push($row.$name);
        $rowsFragment.appendChild($row);
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate current-row only after all other-rows have been created
    WindowRow.hydrateCurrent($currentWindowRow, fgWinfo);

    // Position minimized-heading
    const $firstMinimizedRow = $otherWindowsList.querySelector('.minimized');
    $firstMinimizedRow ?
        $firstMinimizedRow.insertAdjacentElement('beforebegin', $minimizedHeading) :
        $otherWindowsList.appendChild($minimizedHeading);

    // Hydrate globals
    $otherWindowRows.$minimizedHeading = $minimizedHeading;
    $otherWindowRows.$withHeadings = [...$otherWindowsList.children];
    $otherWindowRows.push(...$rows);
    Filter.$shownRows.push(...$rows);
    $names.push($currentWindowRow.$name, ...$_names);
}

const WindowRow = {
    //@ -> state
    init() {
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
                CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--popup-row-button-count', buttonCount);
        Template.$window = $currentWindowRow.cloneNode(true);
    },

    //@ (Object, Boolean) -> (Object)
    create(winfo, currentIncognito) {
        const $row = Template.$window.cloneNode(true);
        WindowRow._hydrate($row, winfo);
        // Disable send/bring/stash buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('button').forEach(disableElement);
            $row.classList.add('tabless');
        } else
        // Indicate if a send/bring action to this window will be a reopen operation
        if (winfo.incognito != currentIncognito)
            $row.classList.add('reopenTabs');
        return $row;
    },

    //@ (Object, Object) -> state
    hydrateCurrent($row, winfo) {
        WindowRow._hydrate($row, winfo);
        disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(disableElement);
        $row.$name.tabIndex = 0;
        $row.$name.title = '';
    },

    //@ (Object, { String, Number, Boolean, Boolean, Number, String, String }) -> state
    _hydrate($row, { givenName, id, incognito, minimized, tabCount, title, titleSansName }) {
        referenceHydrate($row);
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
};

//@ ([Object]) -> state
export async function addAllFolders(folders) {
    if (!folders?.length)
        return;

    // Create stashed-heading
    const $stashedHeading = $otherWindowRows.$minimizedHeading.cloneNode(true);
    $stashedHeading.id = 'stashedHeading';
    $stashedHeading.dataset.heading = 'Stashed';
    $otherWindowsList.appendChild($stashedHeading);

    // Create stashed-rows
    FolderRow.init();
    const $rows = [];
    const $rowsFragment = document.createDocumentFragment();
    for (let folder of folders) {
        const $row = FolderRow.create(folder);
        $rows.push($row);
        $rowsFragment.appendChild($row);
        $names.push($row.$name);
        folder = { id: folder.id }; // Strip down folder objects for Request.popupStashContents()
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate tab counts
    folders = await Request.popupStashContents(folders);
    folders.forEach((folder, i) => $rows[i].$tabCount.textContent = folder.bookmarkCount);

    // Hydrate globals
    $otherWindowRows.$stashedHeading = $stashedHeading;
    $otherWindowRows.$withHeadings.push($stashedHeading, ...$rows);
    $otherWindowRows.push(...$rows);
    Filter.$shownRows.push(...$rows);
}

const FolderRow = {

    //@ -> state
    init() {
        Template.$folder = Template.$window.cloneNode(true);
        Template.$folder.querySelector('.name').placeholder = '(no title)';
        if (CELL_SELECTORS.delete('.bring'))
            disableElement(Template.$folder.querySelector('.bring'));
        if (CELL_SELECTORS.has('.stash'))
            Template.$folder.querySelector('.stash').title = 'Unstash';
        if ($otherWindowsList.classList.contains('filtered'))
            Template.$folder.hidden = true;
    },

    //@ ({ String, String, Object }) -> (Object)
    create({ givenName, id, protoWindow }) {
        const $row = Template.$folder.cloneNode(true);
        referenceHydrate($row);
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.classList.add('stashed');
        $row.classList.toggle('private', protoWindow?.incognito ?? false);
        return $row;
    },
};

// Add references to row's cells, and in each cell a reference back to the row
//@ (Object) -> state
function referenceHydrate($row) {
    for (const selector of CELL_SELECTORS) {
        const $cell = $row.querySelector(selector);
        const reference = selector.replace('.', '$');
        $cell.$row = $row;
        $row[reference] = $cell;
    }
}

//@ (Object) -> state
function disableElement($el) {
    $el.disabled = true;
    $el.tabIndex = -1;
}
