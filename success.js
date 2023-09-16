export default function indicateSuccess($el) {
  $el.classList.add('success', 'show-success');
  setTimeout(() => $el.classList.remove('show-success'), 1000);
}
