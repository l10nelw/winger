(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
    const $currentWindow = document.getElementById('currentWindow');
    const $searchInput = document.getElementById('searchInput');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
    main();
    
    async function main() {
        let allWindows = await browser.windows.getAll(BgP.POPULATE_TABS);
        allWindows.sort(sortLastFocusedDescending);
        for (const window of allWindows) {
            window.focused ? setHeader(window) : addRow(window);
        }
        $windowList.addEventListener('click', onClickRow);
        $searchInput.addEventListener('keyup', onSearchInput);
    }

    function sortLastFocusedDescending(windowA, windowB) {
        return BgP.WindowsData[windowB.id].lastFocused -
               BgP.WindowsData[windowA.id].lastFocused;
    }

    function setHeader(window) {
        const data = BgP.WindowsData[window.id];
        $currentWindow.querySelector('.windowName').textContent = data.name || data.defaultName;
        $currentWindow.querySelector('.badge').textContent = window.tabs.length;
    }

    function addRow(window) {
        const $row = document.importNode($rowTemplate, true);
        const windowId = window.id;
        const data = BgP.WindowsData[windowId];
        $row._id = windowId;
        $row.querySelector('.windowName').textContent = data.name || data.defaultName;
        $row.querySelector('.badge').textContent = window.tabs.length;
        $windowList.appendChild($row);
    }

    function onClickRow(e) {
        const $target = e.target;
        const $row = $target.closest('tr');
        if ($row) {
            browserOperation(e, $row._id, $target.closest('.actionMoveTabs'));
        }
    }

    function onSearchInput(e) {
        const string = $searchInput.value;
        const $firstMatch = searchWindowNames(string);
        if (e.key == 'Enter') {
            browserOperation(e, $firstMatch._id);
        }
    }

    async function browserOperation(e, windowId, otherSendTabCondition) {
        if (e[BgP.ModifierKey.sendTabs] || otherSendTabCondition) {
            BgP.moveSelectedTabs(windowId);
            window.close();
        }
        else
        if (e[BgP.ModifierKey.bringTabs]) {
            await BgP.moveSelectedTabs(windowId, true, true);
            BgP.focusWindow(windowId);
        }
        else
        {
            BgP.focusWindow(windowId);
        }
    }

    function searchWindowNames(string) {
        let $firstMatch;
        if (string) {
            for (const $row of $windowList.children) {
                const data = BgP.WindowsData[$row._id];
                const isMatch = data.name.includes(string) || data.defaultName.includes(string);
                $row.hidden = !isMatch;
                $firstMatch = $firstMatch || (isMatch ? $row : null); // if not already found, it's this row
            }
        } else {
            for (const $row of $windowList.children) {
                $row.hidden = false;
            }
            $firstMatch = $windowList.firstElementChild;
        }
        return $firstMatch;
    }

})()