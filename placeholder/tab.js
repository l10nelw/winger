import * as Settings from '../background/settings.js';
import * as Theme from '../theme.js';

(async () => {
    const SETTINGS = await Settings.retrieve();
    Theme.apply(SETTINGS.theme);
})();

const params = new URL(location).searchParams;
const url    = decodeURIComponent(params.get('url'));
const title  = decodeURIComponent(params.get('title'));

const $head  = document.body.querySelector('h1');
const $main  = document.body.querySelector('main');
const $url   = $main.querySelector('input');
const $btn   = $main.querySelector('button');

const focusUrl = () => $url.select();
const swapBtnText = () => [$btn.textContent, $btn.dataset.text] = [$btn.dataset.text, $btn.textContent];

document.title = title;
$head.textContent = title;
$url.value = url;
focusUrl();

$main.addEventListener('click', ({ target }) => {
    switch (target) {
        case $btn:
            navigator.clipboard.writeText(url);
            swapBtnText();
            setTimeout(swapBtnText, 1500);
        case $url:
            focusUrl();
    }
});
