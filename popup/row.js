import {
    FLAGS,
    $body,
    $currentWindowRow,
    $otherWindowsList,
    $otherWindowRows,
    $names,
} from './common.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

/** @import { NameField$, WindowRow$ } from './common.js' */
/** @import { Winfo, BNode, StashFolder } from '../types.js' */

const CELL_SELECTORS = new Set(['.send', '.bring', '.name', '.tabCount', '.stash']);
/** @type {Object<string, WindowRow$>} */ const Template = {};

/**
 * @param {Winfo} fgWinfo
 * @param {Winfo[]} bgWinfos
 */
export function addAllWindows(fgWinfo, bgWinfos) {
    WindowRow.init();
    const currentIncognito = fgWinfo.incognito;
    /** @type {HTMLLIElement} */ const $minimizedHeading = document.getElementById('minimizedHeading');
    /** @type {WindowRow$[]} */ const $rows = [];
    /** @type {NameField$[]} */const $_names = [];
    const $rowsFragment = document.createDocumentFragment();

    // Create other-rows (by cloning current-row)
    for (const winfo of bgWinfos) {
        /** @type {WindowRow$} */ const $row = WindowRow.create(winfo, currentIncognito);
        $rows.push($row);
        $_names.push($row.$name);
        $rowsFragment.appendChild($row);
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate current-row only after all other-rows have been created
    WindowRow.hydrateCurrent($currentWindowRow, fgWinfo);

    // Position minimized-heading
    /** @type {WindowRow$?} */ const $firstMinimizedRow = $otherWindowsList.querySelector('.minimized');
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
    init() {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring', '.bring'],
            ['show_popup_send', '.send'],
            ['show_popup_stash', '.stash'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            /** @type {HTMLButtonElement} */ const $button = $currentWindowRow.querySelector(selector);
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

    /**
     * @param {Winfo} winfo
     * @param {boolean} currentIncognito
     * @returns {WindowRow$}
     */
    create(winfo, currentIncognito) {
        /** @type {WindowRow$} */ const $row = Template.$window.cloneNode(true);
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

    /**
     * @param {WindowRow$} $row
     * @param {Winfo} winfo
     */
    hydrateCurrent($row, winfo) {
        WindowRow._hydrate($row, winfo);
        disableElement($row);
        $row.querySelectorAll('.tabAction').forEach(disableElement);
        $row.$name.tabIndex = 0;
        $row.$name.title = '';
    },

    /**
     * @param {WindowRow$} $row
     * @param {Winfo} winfo
     */
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

/**
 * @param {BNode[]} folders
 */
export function addAllFolders(folders) {
    // Create stashed-heading
    /** @type {HTMLLIElement} */ const $stashedHeading = $otherWindowRows.$minimizedHeading.cloneNode(true);
    $stashedHeading.id = 'stashedHeading';
    $stashedHeading.dataset.heading = 'Stashed';
    $otherWindowsList.appendChild($stashedHeading);

    // Create stashed-rows
    FolderRow.init();
    /** @type {WindowRow$[]} */ const $rows = [];
    /** @type {NameField$[]} */ const $_names = [];
    const $rowsFragment = document.createDocumentFragment();
    for (let folder of folders) {
        const $row = FolderRow.create(folder);
        $rows.push($row);
        $_names.push($row.$name);
        $rowsFragment.appendChild($row);
        folder = { id: folder.id }; // Strip down folder objects for `Request.popupStashContents()`
    }
    $otherWindowsList.appendChild($rowsFragment);

    // Hydrate globals
    $otherWindowRows.$stashedHeading = $stashedHeading;
    $otherWindowRows.$stashed = $rows;
    $otherWindowRows.$stashed._startIndex = $otherWindowRows.length;
    $names.$stashed = $_names;
    $names.$stashed._startIndex = $names.length;

    // Hydrate tab counts
    Request.popupStashContents(folders).then(folders =>
        folders.forEach((folder, i) => $rows[i].$tabCount.textContent = folder.bookmarkCount)
    );
}

/**
 * @param {Object} [config]
 * @param {boolean} [config.scrollIntoView]
 */
export function toggleViewFolders({ scrollIntoView } = {}) {
    // Stashed-rows visibility governed by CSS (`body.viewstash li.stashed`)
    if ($body.classList.toggle('viewstash')) {
        const $rows = $otherWindowRows.$stashed;
        $otherWindowRows.push(...$rows);
        $otherWindowRows.$withHeadings.push($otherWindowRows.$stashedHeading, ...$rows);
        Filter.$shownRows.push(...$rows);
        $names.push(...$names.$stashed);
        if (scrollIntoView)
            $otherWindowRows.$stashedHeading.previousElementSibling?.scrollIntoView({ behavior: 'smooth' });
    } else {
        const rowIndex = $otherWindowRows.$stashed._startIndex;
        $otherWindowRows.splice(rowIndex);
        $otherWindowRows.$withHeadings.splice(rowIndex + 1); // +1 to account for `$minimizedHeading`
        Filter.$shownRows.splice(rowIndex);
        $names.splice($names.$stashed._startIndex);
    }
}

const FolderRow = {
    init() {
        Template.$folder = Template.$window.cloneNode(true);
        Template.$folder.querySelector('.name').placeholder = '(no title)';
        if (CELL_SELECTORS.delete('.bring'))
            disableElement(Template.$folder.querySelector('.bring'));
        if (CELL_SELECTORS.has('.stash'))
            Template.$folder.querySelector('.stash').title = 'Unstash';
        if ($body.classList.contains('filtered'))
            Template.$folder.hidden = true;
    },

    /**
     * @param {StashFolder}
     * @returns {WindowRow$}
     */
    create({ givenName, id, protoWindow }) {
        /** @type {WindowRow$} */ const $row = Template.$folder.cloneNode(true);
        referenceHydrate($row);
        $row._id = id;
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.classList.add('stashed');
        $row.classList.toggle('private', protoWindow?.incognito ?? false);
        return $row;
    },

};

/**
 * Add references to row's cells, and in each cell a reference back to the row.
 * @param {WindowRow$} $row
 */
function referenceHydrate($row) {
    for (const selector of CELL_SELECTORS) {
        /** @type {HTMLElement & { $row: WindowRow$ }} */
        const $cell = $row.querySelector(selector);
        const reference = selector.replace('.', '$');
        $cell.$row = $row;
        $row[reference] = $cell;
    }
}

/**
 * @param {HTMLElement} $el
 */
function disableElement($el) {
    $el.disabled = true;
    $el.tabIndex = -1;
}
