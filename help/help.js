import { isOS, getShortcut } from '../utils.js';

const $body = document.body;
const $ = (selector, $scope = $body) => $scope.querySelector(selector); //@ (Object, Object|undefined) -> (Object)
const $$ = (selector, $scope = $body) => $scope.querySelectorAll(selector); //@ (Object, Object|undefined) -> ([Object])
$body.onclick = onClick;

Promise.all([
    insertShortcut(),
])
.then(() => {
    insertVersion();
    doOSSpecific();
    updateMockPopups();
});

//@ (Object) -> state
function onClick({ target }) {
    if (target.matches('.themeBtn'))
        return $body.classList.toggle('dark');
    if (target.matches('.settingsBtn'))
        return browser.runtime.openOptionsPage();
    if (target.matches('.tabPanelGroup button'))
        return onTabClick(target);
}

//@ state -> state
async function insertShortcut() {
    const shortcut = await getShortcut();
    if (shortcut !== 'F1')
        $$('.js-shortcut').forEach($el => $el.textContent = $el.textContent.replace('F1', shortcut));
}

//@ state -> state
function insertVersion() {
    const { version } = browser.runtime.getManifest();
    $$('.js-version').forEach($el => $el.textContent = version);
}

//@ state -> state
function doOSSpecific() {
    const isMac = isOS('Mac OS');
    const isWin = isOS('Windows');

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

//@ state -> state
function updateMockPopups() {
    $$('.popup').forEach($popup => {
        const $status = $('.popup-status', $popup);
        if (!$status)
            return;
        const statusText = $status.textContent;
        if (!statusText.includes('#'))
            return;
        const $tabCounts = [...$$('.popup-tabCount', $popup)];
        const tabCount = $tabCounts.reduce((total, $el) => total + parseInt($el.textContent), 0);
        const windowCount = $tabCounts.length;
        $status.textContent = statusText.replace('#', windowCount).replace('#', tabCount);
    });
}

function onTabClick($tab) {
    const $panel = document.getElementById($tab.getAttribute('aria-controls'));
    const $tabPanelGroup = $tab.closest('.tabPanelGroup');
    const $tabs = $$('button', $tabPanelGroup);
    const $panels = $$('details', $tabPanelGroup);
    $tabs.forEach($t => $t.setAttribute('aria-selected', false));
    $tab.setAttribute('aria-selected', true)
    $panels.forEach($p => $p.removeAttribute('open'));
    $panel.setAttribute('open', '');
    return $panel;
}
