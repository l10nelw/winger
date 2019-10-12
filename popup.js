(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
    const $searchInput = document.getElementById('searchInput');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
    main();
    
    async function main() {
        let allWindows = await browser.windows.getAll(BgP.POPULATE_TABS);
        let currentWindowId;
        allWindows.sort(sortLastFocusedDescending);
        for (const window of allWindows) {
            if (window.focused) {
                currentWindowId = window.id;
            } else {
                addRow(window);
            }
        }
        initWindowNamePanel(currentWindowId);
        $windowList.addEventListener('click', onClickRow);
        $searchInput.addEventListener('keyup', onSearchInput);
    }

    function sortLastFocusedDescending(windowA, windowB) {
        return BgP.WindowsData[windowB.id].lastFocused -
               BgP.WindowsData[windowA.id].lastFocused;
    }

    function addRow(window) {
        const $row = document.importNode($rowTemplate, true);
        const windowId = window.id;
        const tabCount = window.tabs.length;
        const data = BgP.WindowsData[windowId];
        $row._id = windowId;
        $row.querySelector('.windowName').innerText = data.name || data.defaultName;
        $row.querySelector('.tabCount').innerText = tabCount;
        $windowList.appendChild($row);
    }


    function onClickRow(e) {
        const $row = e.target.closest('tr');
        if ($row) {
            BgP.focusWindow($row._id);
        }
    }

    function onSearchInput(e) {
        const string = $searchInput.value;
        const $firstMatch = searchWindowNames(string);
        if (e.key == 'Enter') {
            BgP.focusWindow($firstMatch._id);
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