(async () => {

    const BgP = await browser.runtime.getBackgroundPage();
    const $windowList = document.getElementById('windowList');
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
                $windowList.appendChild(createRow(window));
            }
        }
        initWindowNamePanel(currentWindowId);
        $windowList.onclick = onClickRow;
    }

    function sortLastFocusedDescending(windowA, windowB) {
        return BgP.WindowsData[windowB.id].lastFocused -
               BgP.WindowsData[windowA.id].lastFocused;
    }

    function createRow(window) {
        const $row = document.importNode($rowTemplate, true);
        const windowId = window.id;
        const tabCount = window.tabs.length;
        const data = BgP.WindowsData[windowId];
        $row._id = windowId;
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
            await browser.windows.update($row._id, { focused: true });
        }
    }



    // function setWindowName(id, name) {
    //     browser.windows.update(id, {
    //         titlePreface: `${name} - `,
    //     });
    // }
    
})()