export function help() {
    browser.runtime.sendMessage({ help: true });
    window.close();
}

export function settings() {
    browser.runtime.openOptionsPage();
    window.close();
}
