const $status = document.getElementById('status');
export const count = { tabs: 0, windows: 0 };

export function update(text) {
    $status.textContent = text || tabCountText();
}

function tabCountText() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1tab = tabs == 1;
    const is1window = windows == 1;
    return `${tabs} ${is1tab ? 'tab' : 'tabs'} ${is1window ? 'in' : 'across'} ${windows} ${is1window ? 'window' : 'windows'}`;
}
