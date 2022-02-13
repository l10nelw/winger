import * as Request from './request.js';

//@ -> state
export function help() {
    Request.help();
    window.close();
}

//@ -> state
export function settings() {
    browser.runtime.openOptionsPage();
    window.close();
}
