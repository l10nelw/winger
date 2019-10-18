'use strict';

(async () => {

    const $currentWindow = document.getElementById('currentWindow');
    const $searchInput = document.getElementById('searchInput');
    const $windowList = document.getElementById('windowList');
    const $rowTemplate = document.getElementById('rowTemplate').content.firstElementChild;

    const port = browser.runtime.connect({ name: 'popup' });
    port.postMessage({ requestMetadata: true, sortMethod: 'lastFocused' });
    port.onMessage.addListener(message => {
        const focusedWindowId = message.focusedWindowId;
        for (const metaWindow of message.metaWindows) {
            metaWindow.id == focusedWindowId ? setHeader(metaWindow) : addRow(metaWindow);
        }
    });
    $windowList.addEventListener('click', onClickRow);
    $searchInput.addEventListener('keyup', onSearchInput);

    function setHeader(metaWindow) {
        $currentWindow.querySelector('.windowName').textContent = getName(metaWindow);
        $currentWindow.querySelector('.badge').textContent = metaWindow.tabCount;
    }

    function addRow(metaWindow) {
        const $row = document.importNode($rowTemplate, true);
        const name = getName(metaWindow);
        $row._id = metaWindow.id;
        $row._name = name;
        $row.querySelector('.windowName').textContent = name;
        $row.querySelector('.badge').textContent = metaWindow.tabCount;
        $windowList.appendChild($row);
    }

    function onClickRow(event) {
        const $target = event.target;
        const $row = $target.closest('tr');
        if ($row) {
            respondWithBrowserOp(event, $row._id, $target.closest('.actionSendTabs'));
        }
    }

    function onSearchInput(event) {
        const string = $searchInput.value;
        const $firstMatch = searchWindowNames(string);
        if (event.key == 'Enter' && $firstMatch) {
            respondWithBrowserOp(event, $firstMatch._id);
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

    function respondWithBrowserOp(event, windowId, forceSendTabs) {
        const modifierKeys = {
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey, 
        };
        port.postMessage({
            browserOp: 'respond',
            args: [modifierKeys, windowId, !!forceSendTabs],
        });
        window.close();
    }

})()