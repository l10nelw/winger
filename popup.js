(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;
    main();
    
    async function main() {
        const allWindows = await browser.windows.getAll(BgP.POPULATE_TABS);
        let currentWindowId;
        allWindows.sort(sortLastFocusedDescending);

        // Find current window and create rows for all other windows
        for (const window of allWindows) {
            const windowId = window.id;
            if (window.focused) {
                currentWindowId = windowId;
            } else {
                const tabCount = window.tabs.length;
                const data = BgP.WindowsData[windowId];
                const $row = createRow(windowId, tabCount, data);
                $windowList.appendChild($row);
            }
        }
        
        initWindowNamePanel(currentWindowId);
        $windowList.onclick = onClickRow;
    }

    function sortLastFocusedDescending(windowA, windowB) {
        return BgP.WindowsData[windowB.id].lastFocused -
               BgP.WindowsData[windowA.id].lastFocused;
    }

    function createRow(windowId, tabCount, data) {
        const $row = document.importNode($rowTemplate, true);
        $row.dataset.id = windowId;
        $row.querySelector('.windowName').innerText = data.name || data.defaultName;
        $row.querySelector('.tabCount').innerText = tabCount;
        return $row;
    }

    function initWindowNamePanel(id) {
        const $windowNameInput = document.getElementById('windowNameInput');
        // const $windowNameBtn = document.getElementById('windowNameBtn');
        const data = BgP.WindowsData[id];
        $windowNameInput.value = data.name || data.defaultName;
        $windowNameInput.onfocus = $windowNameInput.select;
        // $windowNameBtn.onclick = () => {
        //     setWindowName(id, $windowNameInput.value);
        //     window.close();
        // };
    }

    async function onClickRow(e) {
        const $row = e.target.closest('tr');
        if ($row) {
            const id = parseInt($row.dataset.id);
            await browser.windows.update(id, { focused: true });
        }
    }



    // function setWindowName(id, name) {
    //     browser.windows.update(id, {
    //         titlePreface: `${name} - `,
    //     });
    // }
    
})()