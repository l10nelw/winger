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
    const addCSS = rule => document.styleSheets[0].insertRule(rule);

    if (isOS('Mac OS X')) {
        $$('.js-cmdOnMac').forEach($el => $el.textContent = $el.textContent.replace('Ctrl', 'Cmd'));
        addCSS(`.js-hideOnMac { visibility: hidden }`);
    } else {
        addCSS(`.js-showOnMac { visibility: hidden }`);
    }

    if (isOS('Windows')) {
    } else {
        addCSS(`.js-showOnWin { visibility: hidden }`);
    }
}