//@ -> (Object)
export async function getDict() {
    const manifest = browser.runtime.getManifest().commands;
    const dict = {};
    for (const { name, description, shortcut } of await browser.commands.getAll()) {
        const defaultShortcut = manifest[name].suggested_key.default;
        dict[name] = shortcut !== defaultShortcut ?
            { description, shortcut, defaultShortcut } :
            { description, shortcut };
    }
    return dict;
}

//@ (String) -> (String)
export const format = shortcut => shortcut.split('+').map(key => `<kbd>${key}</kbd>`).join('+');
