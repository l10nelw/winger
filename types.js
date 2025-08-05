/** @import { STORED_PROPS } from './storage.js' */

/** @typedef {number} WindowId */
/** @typedef {number} TabId */
/** @typedef {number} GroupId */
/** @typedef {string} BNodeId */

// Approximations of officially documented objects, listing only properties relevant in this app.
/**
 * Simulates `browser.windows.Window`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/Window}
 * @typedef Window
 * @property {boolean} focused
 * @property {WindowId} id - Required because we don't deal with `id`-less `browser.sessions.getRecentlyClosed()` windows.
 * @property {boolean} incognito
 * @property {string} state
 * @property {Tab[]} [tabs]
 * @property {string} title
 */
/**
 * Simulates `browser.tabs.Tab`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab}
 * @typedef Tab
 * @property {boolean} active
 * @property {boolean} discarded
 * @property {GroupId} groupId
 * @property {boolean} highlighted
 * @property {TabId} id
 * @property {number} index
 * @property {TabId} [openerTabId]
 * @property {boolean} pinned
 * @property {string} title
 * @property {string} url
 * @property {WindowId} windowId
 */
/**
 * Simulates `browser.tabGroups.TabGroup`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/TabGroup}
 * @typedef Group
 * @property {boolean} collapsed
 * @property {string} color
 * @property {GroupId} id
 * @property {string} title
 */
/**
 * Simulates `browser.bookmarks.BookmarkTreeNode`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/BookmarkTreeNode}
 * @typedef BNode
 * @property {BNode[]} [children]
 * @property {BNodeId} id
 * @property {number} index
 * @property {BNodeId} parentId
 * @property {string} type
 * @property {string} [title]
 * @property {string} [url]
 */

// Proto-things: collections of properties used for creating/updating their respective things.
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create}
 * @typedef {Partial<Omit<Window, 'id'|'tabs'|'title'>> & { titlePreface?: string }} ProtoWindow
 */
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create}
 * @typedef {Partial<Omit<Tab, 'id'>> & { muted?: boolean, openInReaderMode?: boolean }} ProtoTab
 */
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/update}
 * @typedef {Partial<Group> & { tabId?: TabId[] }} ProtoGroup
 * @property {TabId[]} [tabIds] - Added and used by `(stash.prop.js).Groups.restore()`
 */
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/CreateDetails}
 * @typedef {Partial<Omit<BNode, 'children'|'id'>>} ProtoBNode
 */

// Various objects specific to this app.
/**
 * A winfo ("window info") is similar to but distinct from a standard `browser.windows.Window` object.
 * May contain as few or as many props as required; copied and/or derived from a `Window` object, and/or previously saved via `browser.sessions.setWindowValue()`.
 * @typedef {Partial<Window> & _Winfo} Winfo
 * @typedef _Winfo
 * @property {WindowId} id
 * @property {EpochTimeStamp} [firstSeen]
 * @property {string} [givenName]
 * @property {EpochTimeStamp} [lastFocused]
 * @property {boolean} [minimized]
 * @property {number} [selectedTabCount]
 * @property {number} [tabCount]
 * @property {string} [titleSansName]
 */
/**
 * Stash folder info object used in FolderList.
 * @typedef {BNode & _stashFolder} StashFolder
 * @typedef _stashFolder
 * @property {number} [bookmarkCount]
 * @property {string} givenName
 * @property {ProtoWindow} [protoWindow]
 */
/**
 * @typedef PopupInitMessage
 * @property {Winfo} fgWinfo
 * @property {Winfo[]} bgWinfos
 * @property {Partial<STORED_PROPS>} flags
 */
/**
 * Request object sent as message from `(popup/request.js).action()`, to `(background/message.js).INTERNAL.action()`,
 * and then `(background/action.js).execute()`, which passes it to smaller functions.
 * @typedef ActionRequest
 * @property {string} action
 * @property {'action'} type
 * @property {string} [argument]
 * @property {BNodeId} [folderId]
 * @property {boolean} [keep_moved_tabs_selected]
 * @property {string} [name]
 * @property {boolean} [remove]
 * @property {boolean} [sendToMinimized]
 * @property {Tab[]} [tabs]
 * @property {WindowId} [windowId]
 */

export {}
