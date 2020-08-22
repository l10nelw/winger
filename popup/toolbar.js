export async function help() {
    await browser.runtime.sendMessage({ help: true });
    window.close();
}

export function settings() {
    browser.runtime.openOptionsPage();
    window.close();
}
