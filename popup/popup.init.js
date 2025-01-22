import {
    FLAGS,
    $body,
    $currentWindowRow,
    $omnibox,
    $otherWindowsList,
    $toolbar,
    $status,
} from './common.js';
import * as Row from './row.js';
import * as Omnibox from './omnibox.js';
import * as Status from './status.js';
import * as Request from './request.js';

Request.popup().then(initPopup).catch(onError);

//@ ({ Object, [Object], Object }) -> state
async function initPopup({ fgWinfo, bgWinfos, flags }) {
    Object.assign(FLAGS, flags);

    const hasName = fgWinfo.givenName || bgWinfos.find(winfo => winfo.givenName);
    $body.classList.toggle('nameless', !hasName);

    Status.init(fgWinfo, bgWinfos);
    Omnibox.init();

    Row.addAllWindows(fgWinfo, bgWinfos);
    Omnibox.respondIfFilled();
}

//@ -> state
function onError() {
    Request.debug();
    Request.showWarningBadge();

    $currentWindowRow.hidden = true;
    $omnibox.hidden = true;
    $otherWindowsList.hidden = true;

    $status.textContent = 'Close and try again. If issue persists, restart Winger.';
    $toolbar.querySelectorAll('button').forEach($button => $button.remove());
    const $restartBtn = document.getElementById('restartTemplate').content.firstElementChild;
    $toolbar.appendChild($restartBtn);
    $restartBtn.onclick = () => browser.runtime.reload();
    $restartBtn.focus();
}
