import { isOS } from '../utils.js';
import * as Shortcut from './shortcut.js';
import * as Storage from '../storage.js';

const $body = document.body;

/**
 * @param {string} selector
 * @param {HTMLElement} [$scope=document.body]
 * @returns {HTMLElement?}
 */
const $ = (selector, $scope = $body) => $scope.querySelector(selector);

/**
 * @param {string} selector
 * @param {HTMLElement} [$scope=document.body]
 * @returns {HTMLElement[]?}
 */
const $$ = (selector, $scope = $body) => $scope.querySelectorAll(selector);

$body.onclick = onClick;
$body.onchange = onChange;

Promise.all([
    loadSettings(),
    insertShortcuts(),
])
.then(() => {
    doOSSpecific();
    updateMockPopups();
});

/**
 * @listens Event#click
 * @param {Event} event
 * @param {HTMLElement} event.target
 */
function onClick({ target }) {
    if (target.matches('.themeBtn'))
        return $body.classList.toggle('dark');
    if (target.matches('.settingsBtn'))
        return browser.runtime.openOptionsPage();
}

/**
 * @listens Event#change
 * @param {Event} event
 * @param {HTMLElement} event.target
 */
function onChange({ target }) {
    if (target.id === 'open_help_on_update')
        return Storage.set({ open_help_on_update: target.checked });
}

async function loadSettings() {
    document.getElementById('open_help_on_update').checked = await Storage.getValue('open_help_on_update');
}

async function insertShortcuts() {
    const shortcutDict = await Shortcut.getDict();
    for (const $shortcut of $$('[data-shortcut]')) {
        const { shortcut } = shortcutDict[$shortcut.dataset.shortcut];
        if ($shortcut.innerText !== shortcut)
            $shortcut.innerHTML = Shortcut.format(shortcut);
    }
}

function doOSSpecific() {
    const isMac = isOS('Mac OS');
    const isWin = isOS('Windows');

    /** @param {string} rule */
    const addCSSRule = rule => document.styleSheets[0].insertRule(rule);
    addCSSRule(`.js-${isMac ? 'hide' : 'show'}OnMac { visibility: hidden }`);
    addCSSRule(`.js-${isWin ? 'hide' : 'show'}OnWin { visibility: hidden }`);

    if (isMac) {
        $$('.js-cmdOnMac kbd').forEach($el => {
            const oldText = $el.textContent;
            const newText = oldText.replace('Ctrl', 'Cmd');
            if (newText !== oldText)
                $el.textContent = newText;
        });
    }
}

function updateMockPopups() {
    $$('.popup').forEach($popup => {
        const $status = $('.popup-status', $popup);
        if (!$status)
            return;
        const statusText = $status.textContent;
        if (!statusText.includes('#'))
            return;
        const $tabCounts = [...$$('.popup-tabCount:not(.nocount)', $popup)];
        const tabCount = $tabCounts.reduce((total, $el) => total + parseInt($el.textContent), 0);
        const windowCount = $tabCounts.length;
        $status.textContent = statusText.replace('#', windowCount).replace('#', tabCount);
    });
}
