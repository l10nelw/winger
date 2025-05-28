import * as Winfo from './winfo.js';
import * as Action from './action.js';
import * as Auto from './action.auto.js';
import * as Chrome from './chrome.js';
import * as Stash from './stash.js';
import * as SendMenu from './menu.send.js';
import * as StashMenu from './menu.stash.js';
import * as Storage from '../storage.js';
import * as Name from '../name.js';

Promise.all([
    Storage.init(),
    Winfo.getAll(['focused', 'firstSeen', 'givenName', 'minimized']),
])
.then(async ([info, winfos]) => {

    browser.menus.removeAll();
    SendMenu.init();
    StashMenu.init();

    Stash.init(info);

    const nameMap = new Name.NameMap();
    let anyNameFound = false;

    // `winfos` should be in id-ascending order, which shall be assumed as age-descending
    for (let { id, focused, firstSeen, givenName, minimized } of winfos) {
        if (givenName) {
            anyNameFound = true;
            // Check if name is already in use (e.g. a named window was restored while Winger was not active)
            // Rename the newer of any duplicate names found
            const uniquifiedName = nameMap.uniquify(givenName);
            if (givenName !== uniquifiedName) {
                givenName = uniquifiedName;
                Name.save(id, givenName);
            }
        }
        nameMap.set(id, givenName);

        if (focused) {
            Storage.set({ _focused_window_id: id });
            Winfo.saveLastFocused(id);
        }

        if (!firstSeen)
            Winfo.saveFirstSeen(id);

        if (minimized && info.discard_minimized_window)
            Auto.discardWindow.schedule(id);
    }

    // If set_title_preface has not been explicitly user-set yet but named windows already exist,
    // then assume user is not a new Winger user and wants it enabled
    if (info.set_title_preface === undefined && anyNameFound) {
        await Storage.set({ set_title_preface: true });
        info.set_title_preface = true;
    }

    Chrome.update(nameMap);

    // Check for version update
    const version = browser.runtime.getManifest().version;
    if (version !== info.version) {
        if (info.show_help_upon_update) {
            // Open help page when there's a major or minor (not patch) version change
            const sansPatch = version => version.split('.', 2).join('.');
            if (sansPatch(version) !== sansPatch(info.version))
                Action.openHelp();
        }
        // Remember new version
        Storage.set({ version });
    }
});