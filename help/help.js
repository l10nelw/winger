import { getShortcut } from '../utils.js';

const $body = document.body;
const $ = (selector, $scope = $body) => $scope.querySelector(selector);
const $$ = (selector, $scope = $body) => $scope.querySelectorAll(selector);

insertVersion();
insertShortcut();
doOSSpecific();
updateMockPopups();
handleCollapse();

function insertVersion() {
    const { version } = browser.runtime.getManifest();
    $$('.js-version').forEach($el => $el.textContent = version);
}

async function insertShortcut() {
    const shortcut = await getShortcut();
    $$('.js-shortcut').forEach($el => $el.textContent = shortcut);
}

function doOSSpecific() {
    const isOS = str => navigator.userAgent.indexOf(str) !== -1;
    const isMac = isOS('Mac OS X');
    const isWin = isOS('Windows');

    const addCSS = rule => document.styleSheets[0].insertRule(rule);
    addCSS(`.js-${isMac ? 'hide' : 'show'}OnMac { visibility: hidden }`);
    addCSS(`.js-${isWin ? 'hide' : 'show'}OnWin { visibility: hidden }`);

    if (isMac) {
        $$('.js-cmdOnMac').forEach($el => $el.textContent = $el.textContent.replace('Ctrl', 'Cmd'));
    }
}

function updateMockPopups() {
    $$('.popup').forEach($popup => {
        const $status = $('.popup-status', $popup);
        if (!$status) return;
        const statusText = $status.textContent;
        if (!statusText.includes('#')) return;
        const $tabCounts = [...$$('.popup-tabCount', $popup)];
        const tabCount = $tabCounts.reduce((total, $el) => total + parseInt($el.textContent), 0);
        const windowCount = $tabCounts.length;
        $status.textContent = statusText.replace('#', tabCount).replace('#', windowCount);
    });
}

async function handleCollapse() {
    const { help_collapse } = await browser.storage.local.get('help_collapse');
    const $collapse = document.getElementById('collapse');
    $collapse.checked = help_collapse;
    $collapse.onchange = () => browser.storage.local.set({ help_collapse: $collapse.checked });
}
