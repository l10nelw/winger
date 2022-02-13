let WindowsMenu, UnstashMenu; // Optional modules

const contextTitle = {
    tab:      'Send Tab to &Window',
    link:     'Open Link in &Window',
    bookmark: '&Unstash',
}

// Create a menu item for each given context.
//@ ([String]) -> state
export async function init(contexts) {
    for (const context of contexts) {
        switch (context) {
            case 'bookmark':
                addMenuItem(context, false); // Starts disabled
                import('./menu.unstash.js').then(module => UnstashMenu = module);
                break;
            case 'tab':
            case 'link':
                addMenuItem(context, true);
                if (!WindowsMenu) WindowsMenu = await import('./menu.windows.js');
                WindowsMenu.init(context);
        }
    }
    WindowsMenu?.updateAvailability();
    browser.menus.onShown.addListener   (onMenuShow);
    browser.menus.onHidden.addListener  (onMenuHide);
    browser.menus.onClicked.addListener (onMenuClick);
}

//@ (String, Boolean) -> state
function addMenuItem(context, enabled) {
    browser.menus.create({
        contexts: [context],
        id: context,
        title: contextTitle[context],
        enabled,
    });
}

//@ (Object, Object), state -> state|null
async function onMenuShow(info, tab) {
    await UnstashMenu?.handleShow(info) || WindowsMenu?.handleShow(info, tab);
}

//@ state -> state|null
function onMenuHide() {
    UnstashMenu?.handleHide();
}

//@ (Object, Object), state -> state|null
function onMenuClick(info, tab) {
    UnstashMenu?.handleClick(info) || WindowsMenu?.handleClick(info, tab);
}

//@ state -> state|null
export function update() {
    WindowsMenu?.updateAvailability();
}