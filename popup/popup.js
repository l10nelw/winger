import { hasClass, addClass, changeClass, getModifiers } from '../utils.js';
import * as Count from './count.js'; // Runs './status.js'
import * as Omnibar from './omnibar.js';
import * as EditMode from './editmode.js';

const $body = document.body;

// Mutated by removeElements(), used by createRow()
const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
const rowElementSelectors = new Set(['.sendBtn', '.bringBtn', '.input', '.tabCount', '.editBtn']);

// Populated by init()
export let OPTIONS, $currentWindowRow, $otherWindowRows, $allWindowRows;

browser.runtime.sendMessage({ popup: true }).then(init);

function init(response) {
    const $currentWindow = document.getElementById('currentWindow');
    const $otherWindows = document.getElementById('otherWindows');
    const { metaWindows, currentWindowId, sortedWindowIds } = response;
    OPTIONS = response.OPTIONS;
    removeElements();

    for (const windowId of sortedWindowIds) {
        const metaWindow = metaWindows[windowId];
        const $row = createRow(metaWindow);
        let $list = $otherWindows;
        if (windowId == currentWindowId) {
            $row.classList.remove('action');
            changeClass('otherRow', 'currentRow', $row);
            changeClass('action', 'invisible', $row.$bringBtn);
            changeClass('action', 'invisible', $row.$sendBtn);
            $row.tabIndex = -1;
            $list = $currentWindow;
        }
        $list.appendChild($row);
    }

    $currentWindowRow = $currentWindow.querySelector('li');
    $otherWindowRows = [...$otherWindows.querySelectorAll('li')];
    $allWindowRows = [$currentWindowRow, ...$otherWindowRows];

    Count.populate();
    indicateReopenAction();
    initTooltips(selectedTabCount);
    lockHeight($otherWindows);

    $body.addEventListener('click', onClick);
    $body.addEventListener('contextmenu', onRightClick);
    $body.addEventListener('keyup', onKeyUp);
}

function removeElements() {
    const elements = {
        popup_bring:   [$rowTemplate, '.bringBtn'],
        popup_send:    [$rowTemplate, '.sendBtn'],
        popup_edit:    [$rowTemplate, '.editBtn'],
        popup_help:    [$body, '#help'],
        popup_options: [$body, '#options'],
    }
    const $document = document.documentElement;
    const styles = getComputedStyle($document);
    const buttonWidth = styles.getPropertyValue('--width-btn-rem');
    let popupWidth = styles.getPropertyValue('--width-body-rem');

    for (const element in elements) {
        if (OPTIONS[element]) continue; // If element enabled, leave it alone
        const [$parent, selector] = elements[element];
        const $element = $parent.querySelector(selector);
        $element.remove();
        if ($parent == $rowTemplate) {
            rowElementSelectors.delete(selector);
            if ($element.tagName == 'BUTTON') popupWidth -= buttonWidth; // Reduce popup width if a row button is removed
        }
    }
    $document.style.setProperty('--width-body-rem', popupWidth);

}

function createRow(metaWindow) {
    const $row = document.importNode($rowTemplate, true);

    // Add references to row elements, and in each, a reference to the row
    rowElementSelectors.forEach(selector => {
        const $element = $row.querySelector(selector);
        const property = selector.replace('.', '$');
        $element.$row = $row;
        $row[property] = $element;
    });

    // Add data
    $row._id = metaWindow.id;
    $row.$input.value = metaWindow.givenName;
    $row.$input.placeholder = metaWindow.defaultName;
    if (metaWindow.incognito) $row.classList.add('private');

    return $row;
}

function indicateReopenAction() {
    const isPrivate = $row => hasClass('private', $row);
    const currentIsPrivate = isPrivate($currentWindowRow);
    for (const $row of $otherWindowRows) {
        if (isPrivate($row) != currentIsPrivate) {
            addClass('reopen', $row.$bringBtn);
            addClass('reopen', $row.$sendBtn);
        }
    }
}

function initTooltips(tabCount) {
    let rowNames = new Map();
    function memoisedRowName($row) {
        let name = rowNames.get($row);
        if (!name) {
            name = rowName($row);
            rowNames.set($row, name);
        }
        return name;
    }
    const tabCountPhrase = tabCount == 1 ? 'tab' : `${tabCount} tabs`;
    const reopenPhrase = '(close-reopen) ';
    const $actions = $body.querySelectorAll('.action');

    for (const $action of $actions) {
        const name = memoisedRowName($action.$row || $action);
        const insertedText = (hasClass('reopen', $action) ? reopenPhrase : '') + tabCountPhrase;
        $action.title = updateTooltipName($action.title, name).replace('#', insertedText);
    }
}

export function updateTooltipName(tooltip, name) {
    const colon = ': ';
    const colonIndex = tooltip.indexOf(colon);
    if (colonIndex > -1) {
        tooltip = tooltip.slice(0, colonIndex + colon.length) + name;
    }
    return tooltip;
}

function lockHeight($el) {
    $el.style.height = ``;
    $el.style.height = `${$el.offsetHeight}px`;
}

function onClick(event) {
    const $target = event.target;
    if ($target.id == 'help') {
        help();
    } else
    if ($target.id == 'options') {
        options();
    } else
    if (EditMode.handleClick($target)) {
        return; // Click handled by EditMode
    } else {
        const $row = $target.closest('.otherRow');
        if ($row) callGoalAction(event, $row._id, $target);
    }
}

function onRightClick(event) {
    if (!hasClass('allowRightClick', event.target)) {
        event.preventDefault();
        return;
    }
}

function onKeyUp(event) {
    const $target = event.target;
    if ($target == Omnibar.$omnibar) {
        Omnibar.onKeyUp(event);
    } else
    if (hasClass('otherRow', $target) && ['Enter', ' '].includes(event.key)) {
        callGoalAction(event, $target._id);
    }
}

export function rowName($row) {
    const $input = $row.$input;
    return $input.value || $input.placeholder;
}

export function help() {
    browser.tabs.create({ url: '/help/help.html' });
    window.close();
}

export function options() {
    browser.runtime.openOptionsPage();
    window.close();
}

export function callGoalAction(event, windowId, $target) {
    let args = [windowId, getModifiers(event)];
    if ($target) args.push(hasClass('bringBtn', $target), hasClass('sendBtn', $target));
    browser.runtime.sendMessage({ goalAction: args });
    window.close();
}