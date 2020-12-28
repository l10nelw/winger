let WindowsMenu, UnstashMenu; // Optional modules

const contextTitle = {
    tab:      'Send Tab to &Window',
    link:     'Open Link in &Window',
    bookmark: '&Unstash',
}

// Create a menu item for each given context.
export async function init(contexts) {
    for (const context of contexts) {
        switch (context) {
            case 'bookmark':
                addMenuItem(context, false); // Starts disabled
                UnstashMenu = await import('./menu.unstash.js');
                break;
            case 'tab':
            case 'link':
                addMenuItem(context, true);
                WindowsMenu = WindowsMenu || await import('./menu.windows.js');
                WindowsMenu.init(context);
        }
    }
    WindowsMenu?.updateAvailability();
    browser.menus.onShown.addListener   (onMenuShow);
    browser.menus.onHidden.addListener  (onMenuHide);
    browser.menus.onClicked.addListener (onMenuClick);
}

function addMenuItem(context, enabled) {
    browser.menus.create({
        contexts: [context],
        id: context,
        title: contextTitle[context],
        enabled,
    });
}

async function onMenuShow(info, tab) {
    if (await UnstashMenu?.handleShow(info)) return;
    WindowsMenu?.handleShow(info, tab);
}

function onMenuHide() {
    UnstashMenu?.handleHide();
}

function onMenuClick(info, tab) {
    if (UnstashMenu?.handleClick(info)) return;
    WindowsMenu?.handleClick(info, tab);
}

export function update() {
    WindowsMenu?.updateAvailability();
}