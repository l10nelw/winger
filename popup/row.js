import {
    FLAGS,
    $body,
    $currentWindowRow,
    $newWindowRow,
    $otherWindowsList,
    $otherWindowRows,
    $names,
    nameMap,
} from './common.js';
import * as Filter from './filter.js';
import * as Request from './request.js';

/** @import { NameField$, WindowRow$ } from './common.js' */
/** @import { WInfo, BNode, StashFolder } from '../types.js' */

const CELL_SELECTORS = new Set(['.send', '.bring', '.icon', '.name', '.tabCount', '.stash']);

/**
 * Base window/folder rows to clone.
 * @type {Object<string, WindowRow$>}
 */
const Template = {};

/**
 * @param {WInfo} fgWinfo
 * @param {WInfo[]} bgWinfos
 */
export function addWindows(fgWinfo, bgWinfos) {
    WindowRow.init(fgWinfo);
    $names.push($currentWindowRow.$name);

    /** @type {HTMLElement} */
    const $headingMinimized = $otherWindowsList.querySelector('window-heading.minimized');
    const $listFragment = document.createDocumentFragment();

    // Create other-window rows
    for (const winfo of bgWinfos) {
        const $row = WindowRow.create(winfo);
        $listFragment.appendChild($row);
        // Populate globals
        $otherWindowRows.push($row);
        Filter.$shownRows.push($row);
        $names.push($row.$name);
    }
    $otherWindowsList.appendChild($listFragment);

    // Position "Minimized" heading
    /** @type {WindowRow$?} */
    const $firstMinimizedRow = $otherWindowsList.querySelector('window-row.minimized');
    $firstMinimizedRow
        ? $firstMinimizedRow.insertAdjacentElement('beforebegin', $headingMinimized)
        : $otherWindowsList.appendChild($headingMinimized);

    // Populate other globals
    $otherWindowRows.$headingMinimized = $headingMinimized;
    $otherWindowRows.$withHeadings = [...$otherWindowsList.children]; // Take the initial "full snapshot"
}

const WindowRow = {
    /**
     * Use the pre-hydrated current-window row to create a window row template, then hydrate current-window row.
     * Hydrate new-window row also.
     * @param {WInfo} fgWinfo
     */
    init(fgWinfo) {
        // Remove any toggled-off buttons
        const buttons = [
            ['show_popup_bring_btn', '.bring'],
            ['show_popup_send_btn', '.send'],
            ['show_popup_stash_btn', '.stash'],
        ];
        let buttonCount = buttons.length;
        for (const [setting, selector] of buttons) {
            /** @type {HTMLButtonElement} */ const $buttonInCurrent = $currentWindowRow.querySelector(selector);
            /** @type {HTMLButtonElement?} */ const $buttonInNew = $newWindowRow.querySelector(selector);
            if (FLAGS[setting]) {
                $buttonInCurrent.hidden = false;
                if ($buttonInNew)
                    $buttonInNew.hidden = false;
            } else {
                $buttonInCurrent.remove();
                $buttonInNew?.remove();
                CELL_SELECTORS.delete(selector);
                buttonCount--;
            }
        }
        if (buttonCount)
            document.documentElement.style.setProperty('--popup-row-button-count', buttonCount);

        // Create window row template
        Template.$window = $currentWindowRow.cloneNode(true);
        Template.$window.removeAttribute('id');

        // Hydrate current-window row
        WindowRow._hydrate($currentWindowRow, fgWinfo);
        disableElement($currentWindowRow);
        $currentWindowRow.querySelectorAll('.tabAction').forEach(disableElement);
        $currentWindowRow.$name.tabIndex = 0;
        $currentWindowRow.$name.title = '';

        // Hydrate new-window row
        hydrateCellReferences($newWindowRow);
        const $togglePrivate = $newWindowRow.querySelector('.togglePrivate');
        if (FLAGS.allow_private) {
            $newWindowRow.classList.toggle('private', fgWinfo.incognito);
            $newWindowRow.$togglePrivate = $togglePrivate;
            $togglePrivate.$row = $newWindowRow;
            $togglePrivate.hidden = false;
        } else {
            $togglePrivate.remove();
        }
    },

    /**
     * Create an other-window row.
     * @param {WInfo} winfo
     * @returns {WindowRow$}
     */
    create(winfo) {
        /** @type {WindowRow$} */
        const $row = Template.$window.cloneNode(true);
        WindowRow._hydrate($row, winfo);
        // Disable action buttons if popup/panel-type window
        if (winfo.type !== 'normal') {
            $row.querySelectorAll('button').forEach(disableElement);
            $row.classList.add('tabless');
        }
        return $row;
    },

    /**
     * @param {WindowRow$} $row
     * @param {WInfo} winfo
     */
    _hydrate($row, { givenName, id, incognito, minimized, tabCount, title, titleSansName }) {
        hydrateCellReferences($row);
        title = titleSansName || title || '';
        // Add data
        $row._id = id;
        $row.setAttribute('aria-labelledby', id);
        $row.$name.id = id; // For `$row`'s `aria-labelledby` to reference `$name`'s current value
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
 * Add stashed-window rows. Assumes `folders` is not empty.
 * @param {BNode[]} folders
 */
export function addFolders(folders) {
    // Create stashed-heading
    /** @type {HTMLElement} */
    const $headingStashed = $otherWindowRows.$headingMinimized.cloneNode(true);
    $headingStashed.classList.replace('minimized', 'stashed');
    $headingStashed.dataset.title = 'Stashed';
    $otherWindowsList.appendChild($headingStashed);

    // Create stashed-rows
    FolderRow.init();
    /** @type {WindowRow$[]} */ const $rows = [];
    /** @type {NameField$[]} */ const $_names = [];
    const $listFragment = document.createDocumentFragment();
    for (const folder of folders) {
        const $row = FolderRow.create(folder);
        $rows.push($row);
        $_names.push($row.$name);
        $listFragment.appendChild($row);
    }
    $otherWindowsList.appendChild($listFragment);

    // Hydrate globals
    $otherWindowRows.$headingStashed = $headingStashed;
    $otherWindowRows.$stashed = $rows;
    $otherWindowRows.$stashed._startIndex = $otherWindowRows.length;
    $names.$stashed = $_names;
    $names.$stashed._startIndex = $names.length;
    if (nameMap.size)
        nameMap.populate($_names); // If already populated with window names, add folder names too

    // Hydrate bookmark counts
    Request.popupStashSizes(folders).then(folders => FolderRow.hydrateCounts($rows, folders));
}

/**
 * Show or hide stashed-window rows. Assumes they are already added.
 * @param {Object} [config]
 * @param {boolean} [config.scrollIntoView]
 */
export function toggleViewFolders({ scrollIntoView } = {}) {
    // Stashed-window rows display is governed by popup.css
    if ($body.classList.toggle('viewstash')) {
        const $rows = $otherWindowRows.$stashed;
        $otherWindowRows.push(...$rows);
        $otherWindowRows.$withHeadings.push($otherWindowRows.$headingStashed, ...$rows);
        Filter.$shownRows.push(...$rows);
        $names.push(...$names.$stashed);
        if (scrollIntoView)
            $rows[0].scrollIntoView({ behavior: 'smooth' });
    } else {
        const rowIndex = $otherWindowRows.$stashed._startIndex;
        $otherWindowRows.splice(rowIndex);
        $otherWindowRows.$withHeadings.splice(rowIndex + 1); // +1 to account for `$headingMinimized`
        Filter.$shownRows.splice(rowIndex);
        $names.splice($names.$stashed._startIndex);
    }
}

const FolderRow = {
    /**
     * Use the window row template to create a folder row template.
     */
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
     * Create a folder row.
     * @param {StashFolder}
     * @returns {WindowRow$}
     */
    create({ givenName, id, protoWindow }) {
        /** @type {WindowRow$} */
        const $row = Template.$folder.cloneNode(true);
        hydrateCellReferences($row);
        $row._id = id;
        $row.setAttribute('aria-labelledby', id);
        $row.$name.id = id; // For aria-labelledby
        $row.$name._id = id;
        $row.$name.value = givenName;
        $row.classList.add('stashed');
        $row.classList.toggle('private', protoWindow?.incognito ?? false);
        return $row;
    },

    /**
     * @param {WindowRow$[]} $rows
     * @param {StashFolder[]} folders
     */
    hydrateCounts($rows, folders) {
        folders.forEach((folder, i) => $rows[i].$tabCount.textContent = folder.bookmarkCount);
    },
};

/**
 * Add references to row's cells, and in each cell a reference back to the row.
 * @param {WindowRow$} $row
 */
function hydrateCellReferences($row) {
    for (const selector of CELL_SELECTORS) {
        /** @type {(HTMLElement & { $row: WindowRow$ })?} */
        const $cell = $row.querySelector(selector);
        if ($cell) {
            $row[selector.replace('.', '$')] = $cell;
            $cell.$row = $row;
        }
    }
}

/**
 * @param {HTMLElement} $el
 */
function disableElement($el) {
    $el.disabled = true;
    $el.tabIndex = -1;
}
