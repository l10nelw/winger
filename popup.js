'use strict';

(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
    const $currentWindow = document.getElementById('currentWindow');
    const $searchInput = document.getElementById('searchInput');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
    main();
    
    async function main() {
        // let allWindows = await browser.windows.getAll({ populate: true });
        allWindows.sort(sortLastFocusedDescending);
        for (const window of allWindows) {
            window.focused ? setHeader(window) : addRow(window);
        }
        $windowList.addEventListener('click', onClickRow);
        $searchInput.addEventListener('keyup', onSearchInput);
    }

    function sortLastFocusedDescending(windowA, windowB) {
        return BgP.Metadata[windowB.id].lastFocused -
               BgP.Metadata[windowA.id].lastFocused;
    }

    function setHeader(window) {
        $currentWindow.querySelector('.windowName').textContent = BgP.Metadata.getName(window.id);
        $currentWindow.querySelector('.badge').textContent = window.tabs.length;
    }

    function addRow(window) {
        const $row = document.importNode($rowTemplate, true);
        const windowId = window.id;
        const name = BgP.Metadata.getName(windowId);
        $row._id = windowId;
        $row._name = name;
        $row.querySelector('.windowName').textContent = name;
        $row.querySelector('.badge').textContent = window.tabs.length;
        $windowList.appendChild($row);
    }

    function onClickRow(event) {
        const $target = event.target;
        const $row = $target.closest('tr');
        if ($row) {
            window.close();
            BgP.BrowserOp.respond(event, $row._id, $target.closest('.actionSendTabs'));
        }
    }

    function onSearchInput(event) {
        const string = $searchInput.value;
        const $firstMatch = searchWindowNames(string);
        if (event.key == 'Enter') {
            window.close();
            BgP.BrowserOp.respond(event, $firstMatch._id);
        }
    }

    function searchWindowNames(string) {
        const $rows = $windowList.rows;
        let $firstMatch;
        if (string) {
            for (const $row of $rows) {
                const isMatch = $row._name.includes(string);
                $row.hidden = !isMatch;
                $firstMatch = $firstMatch || (isMatch ? $row : null); // if not already found, it's this row
            }
        } else {
            for (const $row of $rows) {
                $row.hidden = false;
            }
            $firstMatch = $rows[0];
        }
        return $firstMatch;
    }

})()