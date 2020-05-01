const $$ = selector => document.body.querySelectorAll(selector);
$$('.js-version').forEach($el => $el.textContent = browser.runtime.getManifest().version);
browser.commands.getAll().then(commands => {
    $$('.js-shortcut').forEach($el => $el.textContent = commands[0].shortcut);
}).then(() => {
    if (navigator.userAgent.indexOf('Mac OS X') !== -1) {
        $$('.js-cmdOnMac').forEach($el => $el.textContent = $el.textContent.replace('Ctrl', 'Cmd'));
        $$('.js-hideOnMac').forEach($el => $el.style.visibility = 'hidden');
    }
});