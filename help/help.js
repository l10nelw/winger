const $body = document.body;
const $ = (selector, $scope = $body) => $scope.querySelector(selector);
const $$ = (selector, $scope = $body) => $scope.querySelectorAll(selector);

populateSidebar();
insertVersion();
insertShortcut();
doOSSpecific();
    
function populateSidebar() {
    const $aside = $('aside');
    $$('h2, h3', $('main')).forEach($h => {
        $h = $h.cloneNode(true);
        $h.className = '';
        $aside.appendChild($h);
    });
}

function insertVersion() {
    const { version } = browser.runtime.getManifest();
    $$('.js-version').forEach($el => $el.textContent = version);
}

async function insertShortcut() {
    const [{ shortcut }] = await browser.commands.getAll();
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