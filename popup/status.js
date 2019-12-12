const $status = document.getElementById('status');

export const count = {
    tabs: 0,
    windows: 0,
};

export function update() {
    const tabs = count.tabs;
    const windows = count.windows;
    const is1Tab = tabs == 1;
    const is1Window = windows == 1;
    $status.textContent =
        `${tabs} ${is1Tab ? 'tab' : 'tabs'} ` +
        `${is1Window ? 'in' : 'across'} ` +
        `${windows} ${is1Window ? 'window' : 'windows'}`;
}
