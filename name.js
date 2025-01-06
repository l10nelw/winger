const NUMBER_POSTFIX = / (\d+)$/;

//@ (Number), state -> (String)
export async function load(windowId) {
    return await browser.sessions.getWindowValue(windowId, 'givenName') || '';
}

//@ (Number, String) -> (Boolean), state
export function save(windowId, name) {
    return browser.sessions.setWindowValue(windowId, 'givenName', name).then(() => true).catch(() => false);
}

// Add " 2" at the end of name, or increment an existing number postfix.
//@ (String) -> (String)
function addNumberPostfix(name) {
    const found = name.match(NUMBER_POSTFIX);
    return found ?
        `${name.slice(0, found.index)} ${+found[1] + 1}` : `${name} 2`;
}

// Remove spaces and illegal characters from name.
//@ (String) -> (String)
export function validify(name) {
    name = name.trim();
    return startsWithSlash(name) ?
        validify(name.slice(1)) : name;
}

//@ (String) -> (Boolean)
function startsWithSlash(name) {
    return name.startsWith('/');
}

// Map windowIds/folderIds to names, and provide methods that work in the context of all present names.
export class NameMap extends Map {

    // `objects` is either an array of $names, or an array of winfos containing givenNames.
    //@ ([Object]) -> (Map(Number|String:String)), state
    populate(objects) {
        if (objects[0] instanceof HTMLInputElement) {
            for (const { _id, value } of objects) // $names
                this.set(_id, value);
        } else {
            for (const { id, givenName } of objects) // winfos
                this.set(id, givenName);
        }
        return this;
    }

    // Has at least one open-window name (excludes stashed-windows).
    // Expects all stashed-windows to be at the end of the map.
    //@ state -> (Boolean)
    hasWindowName() {
        for (const [id, name] of this)
            if (typeof id !== 'number') // No more open-windows in loop
                return false;
            else if (name)
                return true;
    }

    // Find name in map. Ignores blank. Return associated id if found, else return 0.
    //@ (String), state -> (NumberString)
    findId(name) {
        if (name)
            for (const [id, _name] of this)
                if (name === _name)
                    return id;
        return 0;
    }

    // Check name against map for errors, including duplication.
    // Return 0 if name is blank or valid-and-unique or conflicting id is excludeId. Else return -1 or conflicting id.
    //@ (String, Number|String), state -> (Number)
    checkForErrors(name, excludeId) {
        if (!name)
            return 0;
        if (startsWithSlash(name))
            return -1;
        const foundId = this.findId(name);
        return foundId === excludeId ?
            0 : foundId;
    }

    // Check valid name against map for duplication. Ignores blank. If name is not unique, add/increment number postfix. Return unique result.
    //@ (String), state -> (String)
    uniquify(name) {
        return (name && this.findId(name)) ?
            this.uniquify(addNumberPostfix(name)) : name;
    }
}
