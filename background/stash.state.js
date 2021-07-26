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
