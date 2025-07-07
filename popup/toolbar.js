import * as Request from './request.js';

export function help() {
    Request.help();
    window.close();
}

export function settings() {
    browser.runtime.openOptionsPage();
    window.close();
}
