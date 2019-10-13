var POPULATE_TABS = { populate: true, windowTypes: ['normal'] };

var WindowsData = {};
var LastWindowNumber = 0;
var ModifierKey = {
    sendTabs: 'shiftKey',
    bringTabs: 'ctrlKey',
};

initWindowsData();
browser.windows.onCreated.addListener(onWindowCreated);
browser.windows.onRemoved.addListener(onWindowRemoved);
browser.windows.onFocusChanged.addListener(onWindowFocused);


async function initWindowsData() {
    const allWindows = await browser.windows.getAll(POPULATE_TABS);
    for (const window of allWindows) {
        addWindowsDataItem(window.id);
    }
}

function onWindowCreated(window) {
    const id = window.id;
    addWindowsDataItem(id);
}

function onWindowRemoved(id) {
    removeWindowsDataItem(id);
}

function onWindowFocused(id) {
    if (id > 0) {
        WindowsData[id].lastFocused = Date.now();
    }
}

function addWindowsDataItem(id) {
    WindowsData[id] = {};
    WindowsData[id].lastFocused = Date.now();
    WindowsData[id].defaultName = `Window ${++LastWindowNumber} / id ${id}`;
    WindowsData[id].name = ``;
}

function removeWindowsDataItem(id) {
    delete WindowsData[id];
}

function focusWindow(id) {
    browser.windows.update(id, { focused: true });
}

async function moveSelectedTabs(windowId, stayActive, staySelected) {
    const selectedTabs = await browser.tabs.query({ currentWindow: true, highlighted: true });
    const selectedTabIds = selectedTabs.map(tab => tab.id);
    await browser.tabs.move(selectedTabIds, { windowId: windowId, index: -1 });

    if (stayActive) {
        const activeTab = objectArray.firstWith(selectedTabs, 'active', true);
        browser.tabs.update(activeTab.id, { active: true });
    }
    if (staySelected) {
        for (const id of selectedTabIds) {
            browser.tabs.update(id, { highlighted: true, active: false });
        }
    }
}

var objectArray = {

    firstWith(objects, key, value) {
        for (const object of objects) {
            if (object[key] === value) return object;
        }
    },

}