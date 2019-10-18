'use strict';

(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
    const $currentWindow = document.getElementById('currentWindow');
    const $searchInput = document.getElementById('searchInput');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
    main();
    
    async function main() {
        const currentWindowId = BgP.Metadata.focused;
        let metaWindows = BgP.Metadata.items('lastFocused');
        for (const metaWindow of metaWindows) {
            metaWindow.id == currentWindowId ? setHeader(metaWindow) : addRow(metaWindow);
        }
        $windowList.addEventListener('click', onClickRow);
        $searchInput.addEventListener('keyup', onSearchInput);
    }

    function setHeader(metaWindow) {
        $currentWindow.querySelector('.windowName').textContent = getName(metaWindow);
        $currentWindow.querySelector('.badge').textContent = metaWindow.tabCount;
    }

    function addRow(metaWindow) {
        const $row = document.importNode($rowTemplate, true);
        const windowId = metaWindow.id;
        const name = getName(metaWindow);
        $row._id = windowId;
        $row._name = name;
        $row.querySelector('.windowName').textContent = name;
        $row.querySelector('.badge').textContent = BgP.Metadata[windowId].tabCount;
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

    function getName(metaWindow) {
        return metaWindow.givenName || metaWindow.defaultName;
    }

    // Hides rows whose names do not contain string. Returns first matching row or null
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