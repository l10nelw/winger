import { isOS } from '../utils.js';
import * as Shortcut from './shortcut.js';
import * as Storage from '../storage.js';

const $body = document.body;

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
 * @param {{ target: HTMLElement }} event
 */
function onClick({ target }) {
    if (target.matches('.themeBtn'))
        return $body.classList.toggle('dark');
    if (target.matches('.settingsBtn'))
        return browser.runtime.openOptionsPage();
}

/**
 * @param {{ target: HTMLElement }} event
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
    for (const $shortcut of $body.querySelectorAll('[data-shortcut]')) {
        const { shortcut } = shortcutDict[$shortcut.dataset.shortcut];
        if ($shortcut.innerText !== shortcut)
            $shortcut.replaceChildren(Shortcut.formatHTML(shortcut));
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
        $body.querySelectorAll('.js-cmdOnMac kbd').forEach($el => {
            const oldText = $el.textContent;
            const newText = oldText.replace('Ctrl', 'Cmd');
            if (newText !== oldText)
                $el.textContent = newText;
        });
    }
}

function updateMockPopups() {
    $body.querySelectorAll('.popup').forEach($popup => {
        const $status = $popup.querySelector('.popup-status');
        if (!$status)
            return;
        const statusText = $status.textContent;
        if (!statusText.includes('#'))
            return;
        const $tabCounts = [...$popup.querySelectorAll('.popup-tabCount:not(.nocount)')];
        const tabCount = $tabCounts.reduce((total, $el) => total + parseInt($el.textContent), 0);
        const windowCount = $tabCounts.length;
        $status.textContent = statusText.replace('#', windowCount).replace('#', tabCount);
    });
}
