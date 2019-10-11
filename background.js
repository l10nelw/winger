var POPULATE_TABS = { populate: true, windowTypes: ['normal'] };

var WindowsData = {};
var LastWindowNumber = 0;

(async () => {
    await initWindowsData();
})();

browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);


async function initWindowsData() {
    const allWindows = await browser.windows.getAll(POPULATE_TABS);
    for (const window of allWindows) {
        addEntryToWindowsData(window.id);
    }
}

function onWindowCreated(window) {
    const id = window.id;
    addEntryToWindowsData(id);
}

function onWindowRemoved(id) {
    delete WindowsData[id];
}

function onWindowFocused(id) {
    if (id > 0) {
        WindowsData[id].lastFocused = Date.now();
    }
}

function addEntryToWindowsData(id) {
    WindowsData[id] = {};
    WindowsData[id].lastFocused = Date.now();
    WindowsData[id].defaultName = `Window ${++LastWindowNumber} / id ${id}`;
    WindowsData[id].name = ``;
}

// Get tab count
// ... of current window, when tabs are created/removed // ~window is focused~
// - tabs.onCreated, tabs.onRemoved
// - browser.windows.getLastFocused(POPULATE_TABS)
// - browser.browserAction.setBadgeText({ windowId: id, text: badgeText })
// ... of source and destination windows, when tabs are moved
// - tabs.move(tabIds, { windowId: id, index: -1 })
// - browser.windows.get(id, POPULATE_TABS)
// - browser.browserAction.setBadgeText({ windowId: id, text: badgeText })

