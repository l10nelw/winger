export const SEND  = 'Ctrl';
export const BRING = 'Shift';
export const STASHCOPY = 'Shift';

const EVENT_KEYS = {
    ctrlKey:  SEND,
    shiftKey: BRING,
}

const MODIFIABLE_ACTIONS_TABLE = {
    switch:      { [SEND]: 'send',        [BRING]: 'bring' },
    new:         { [SEND]: 'kick',        [BRING]: 'pop' },
    newnormal:   { [SEND]: 'kicknormal',  [BRING]: 'popnormal' },
    newprivate:  { [SEND]: 'kickprivate', [BRING]: 'popprivate' },
    bring:       { [SEND]: 'send' },
    pop:         { [SEND]: 'kick' },
    popnormal:   { [SEND]: 'kicknormal' },
    popprivate:  { [SEND]: 'kickprivate' },
    send:        { [BRING]: 'bring' },
    kick:        { [BRING]: 'pop' },
    kicknormal:  { [BRING]: 'popnormal' },
    kickprivate: { [BRING]: 'popprivate' },
}

//@ (Object) -> ([String])
export function get(event) {
    const modifiers = [];
    for (const key in EVENT_KEYS)
        if (event[key])
            modifiers.push(EVENT_KEYS[key]);
    return modifiers;
}

// Change an action to another based on given event or array of modifiers.
//@ (String, [String]|undefined) -> (String)
export function modify(action, modifiers) {
    if (!modifiers.length)
        return action;
    const modifiedActionDict = MODIFIABLE_ACTIONS_TABLE[action];
    if (!modifiedActionDict)
        return action;
    for (const modifier in modifiedActionDict)
        if (modifiers.includes(modifier))
            return modifiedActionDict[modifier];
    return action;
}
