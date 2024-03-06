const params = new URL(location).searchParams;
const url    = params.get('url');
const title  = params.get('title');

const $head  = document.body.querySelector('h1');
const $main  = document.body.querySelector('main');
const $url   = $main.querySelector('input');
const $btn   = $main.querySelector('button');

const swapBtnText = () => [$btn.textContent, $btn.dataset.text] = [$btn.dataset.text, $btn.textContent];

document.title = title;
$head.textContent = title;
$url.value = url;
$url.select();

$main.addEventListener('click', ({ target }) => {
    switch (target) {
        case $btn:
            navigator.clipboard.writeText(url);
            swapBtnText();
            setTimeout(swapBtnText, 1000);
        case $url:
            $url.select();
    }
});
