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

// Map windowIds to names, and provide methods that work in the context of all present names.
export class NameMap extends Map {

    // `objects` should either be an array of winfos containing givenNames, or an array of $names.
    //@ ([Object]) -> (Map(Number:String)), state
    populate(objects) {
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

// Map windowIds to titlePrefaces, and provide the means to infer names from them.
// Workflow: populate(), findTrimLengths() to get trimLengths, then extractNames(trimLengths). Redo extractNames(trimLengthsModified) if needed.
export class TitlePrefaceMap extends Map {
    _values = []; // Internal populate-once read-frequently substitute for this.values()

    // Add non-blank title prefaces to the Map.
    //@ ([Object]) -> (Map(Number:String)), state
    populate(winfos) {
        for (const { id, titlePreface } of winfos) {
            if (titlePreface) {
                this.set(id, titlePreface);
                this._values.push(titlePreface);
            }
        }
        return this;
    }

    // Work out left and right trim lengths for extractNames by finding common characters to trim away.
    //@ state -> ({ Number, Number })
    findTrimLengths() {
        let leftCharIndex = 0;
        let rightCharIndex = -1;
        while (this._sameCharsAtIndex(leftCharIndex++));
        while (this._sameCharsAtIndex(rightCharIndex--));
        return {
            left: leftCharIndex - 1,
            right: Math.abs(rightCharIndex + 2),
        };
    }

    //@ (Number), state -> (Boolean)
    _sameCharsAtIndex(charIndex) {
        const char = this._values[0].at(charIndex);
        for (let stringIndex = this._values.length; --stringIndex;) // Iterate from _values.length-1 to 1
            if (this._values[stringIndex].at(charIndex) !== char)
                return false;
        return true;
    }

    // Given left and right trim lengths, slice title prefaces to get a NameMap of extracted names.
    //@ ({ Number, Number }), state -> (Map(Number:String))
    extractNames({ left, right }) {
        const extractedNameMap = new NameMap();
        for (const [id, titlePreface] of this)
            extractedNameMap.set(id, titlePreface.slice(left, titlePreface.length - right));
        return extractedNameMap;
    }
}