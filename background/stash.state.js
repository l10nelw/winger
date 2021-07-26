const PREFACE = '/ｗ?';


/* --- STASH --- */

const propToParam = {
    active:         (boolean) => boolean ? 'focused' : null,
    pinned:         (boolean) => boolean ? 'pinned' : null,
    id:             (tabId, { folderId }) => `id=${folderId}${tabId}`, // Mandatory for "parent=" to be useful
    openerTabId:    (tabId, { folderId }) => tabId ? `parent=${folderId}${tabId}` : null,
};

// Produce bookmark title that encodes tab state.
export function writeTabTitle(tab, folderId) {
    const parameters = [];
    const helperDict = { folderId };
    for (const prop in propToParam) if (prop in tab) {
        const parameter = propToParam[prop](tab[prop], helperDict);
        if (parameter) parameters.push(parameter);
    }
    const statefulTitle = `${tab.title}    ${PREFACE}${parameters.join('&')}`;
    // Mandatory PREFACE resolves most cases where PREFACE exists in original title
    return statefulTitle;
}


/* --- UNSTASH --- */

const paramToProp = {
    pinned:    () => ({ pinned: true }),
    focused:   () => ({ active: true }),
    id:        (stashedId) => ({ stashedId }),
    parent:    (stashedId) => ({ stashedParentId: stashedId }),
};

// Get properties, including state, for tab creation (a protoTab).
export function readTitle(title) {
    const prefaceIndex = title.lastIndexOf(PREFACE); // Find last occurence in case PREFACE also exists in original title
    if (prefaceIndex === -1) return;

    const properties = { title: title.slice(0, prefaceIndex).trim() };

    const parameters = title.slice(prefaceIndex + PREFACE.length).split('&');
    for (const parameter of parameters) {
        const [paramKey, paramValue] = parameter.split('=');
        if (!(paramKey in paramToProp)) continue;
        Object.assign( properties, paramToProp[paramKey](paramValue) );
    }

    return properties;
}
