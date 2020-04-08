const $body = document.body;
if (navigator.userAgent.indexOf('Mac OS X') !== -1) {
    $body.querySelectorAll('.js-cmdOnMac').forEach($el => $el.textContent = $el.textContent.replace('Ctrl', 'Cmd'));
    $body.querySelectorAll('.js-hideOnMac').forEach($el => $el.style.visibility = 'hidden');
}
