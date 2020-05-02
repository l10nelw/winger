(async ()=>{

    const $$ = selector => document.body.querySelectorAll(selector);

    const { version } = browser.runtime.getManifest();
    $$('.js-version').forEach($el => $el.textContent = version);

    const [{ shortcut }] = await browser.commands.getAll();
    $$('.js-shortcut').forEach($el => $el.textContent = shortcut);

    if (navigator.userAgent.indexOf('Mac OS X') !== -1) {
        $$('.js-cmdOnMac').forEach($el => $el.textContent = $el.textContent.replace('Ctrl', 'Cmd'));
        document.styleSheets[0].insertRule(`.js-hideOnMac { visibility: hidden }`);
    }

})();
