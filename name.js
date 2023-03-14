export const NO_NAME = '(no name)';
const NUMBER_POSTFIX = / (\d+)$/;

//@ (Number), state -> (String)
export async function load(windowId) {
    const givenName = await browser.sessions.getWindowValue(windowId, 'givenName');
    return givenName || '';
}

//@ (Number, String) -> state
export function save(windowId, name) {
    browser.sessions.setWindowValue(windowId, 'givenName', name);
}

// Add " 2" at the end of name, or increment an existing number postfix.
//@ (String) -> (String)
function addNumberPostfix(name) {
    const found = name.match(NUMBER_POSTFIX);
    return found ?
        `${name.slice(0, found.index)} ${Number(found[1]) + 1}` : `${name} 2`;
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

// NameMap maps windowIds to names (Number:String), and provides methods that require all present names as context.
export class NameMap extends Map {

    // `objects` should be an array of winfos containing givenNames, or an array of $names.
    //@ ([Object]) -> (Map(Number:String)), state
    bulkSet(objects) {
        if ('givenName' in objects[0]) {
            for (const { id, givenName } of objects) // winfos
                this.set(id, givenName);
        } else
        if ('value' in objects[0]) {
            for (const { _id, value } of objects) // $names
                this.set(_id, value);
        }
        return this;
    }

    // Find name in map. Ignores blank. Return associated id if found, else return 0.
    //@ (String), state -> (Number)
    findId(name) {
        if (name)
            for (const [id, _name] of this)
                if (name === _name)
                    return id;
        return 0;
    }

    // Check name against map for errors, including duplication.
    // Return 0 if name is blank or valid-and-unique or conflicting windowId is excludeId.
    // Else return -1 or conflicting windowId.
    //@ (String, Number), state -> (Number)
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
        return this.findId(name) ?
            this.uniquify(addNumberPostfix(name)) : name;
    }
}
