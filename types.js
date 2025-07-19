/** @typedef {number} WindowId */
/**
 * @typedef Window
 * @property {boolean} focused
 * @property {WindowId} id
 * @property {boolean} incognito
 * @property {string} state
 * @property {Tab[]} [tabs]
 * @property {string} title
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/Window}
 */
/**
 * `browser.windows.create()` argument object.
 * @typedef ProtoWindow
 * @property {boolean} [focused]
 * @property {boolean} [incognito]
 * @property {string} [state]
 * @property {string} [titlePreface]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create}
 */
/**
 * A winfo ("window info") is similar to but distinct from a standard `browser.windows.Window` object.
 * May contain as few or as many props as required; copied and/or derived from a `Window` object, and/or previously saved via `browser.sessions`.
 * @typedef Winfo
 * @property {WindowId} id
 * @property {number} [firstSeen]
 * @property {string} [givenName]
 * @property {number} [lastFocused]
 * @property {boolean} [minimized]
 * @property {number} [selectedTabCount]
 * @property {number} [tabCount]
 * @property {string} [title]
 * @property {string} [titleSansName]
 * From `Window`:
 * @property {boolean} [incognito]
 */
/** @typedef {number} TabId */
/**
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
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/Tab}
 */
/**
 * `browser.tabs.create()` argument object.
 * @typedef ProtoTab
 * @property {boolean} [active]
 * @property {string} [cookieStoreId]
 * @property {boolean} [discarded]
 * @property {number} [index]
 * @property {boolean} [muted]
 * @property {TabId} [openerTabId]
 * @property {boolean} [openInReaderMode]
 * @property {boolean} [pinned]
 * @property {string} [title]
 * @property {string} [url]
 * @property {WindowId} [windowId]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create}
 */
/** @typedef {number} GroupId */
/**
 * @typedef Group
 * @property {boolean} collapsed
 * @property {string} color
 * @property {GroupId} id
 * @property {string} title
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/TabGroup}
 */
/**
 * `browser.tabGroups.update()` argument object.
 * @typedef ProtoGroup
 * @property {boolean} [collapsed]
 * @property {string} [color]
 * @property {string} [title]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/update}
 * @property {number} [id] - groupId at stash time
 * @property {TabId[]} [tabIds] - Added and used by `(stash.prop.js).Groups.restore()`
 */
/** @typedef {string} BNodeId */
/**
 * @typedef BNode
 * @property {BNode[]} [children]
 * @property {BNodeId} id
 * @property {number} index
 * @property {BNodeId} parentId
 * @property {string} type
 * @property {string} [title]
 * @property {string} [url]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/BookmarkTreeNode}
 */
/**
 * `browser.bookmarks.create()` argument object.
 * @typedef ProtoBNode
 * @property {number} [index]
 * @property {BNodeId} [parentId]
 * @property {string} [title]
 * @property {string} [type]
 * @property {string} [url]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/CreateDetails}
 */
/**
 * Stash folder info object used in FolderList and stored in cache.
 * @typedef StashFolder
 * @property {BNodeId} id
 * @property {number} index
 * @property {string} [title]
 * @property {string} [givenName]
 * @property {number} [bookmarkCount]
 * @property {ProtoWindow} [protoWindow]
 */
/**
 * @typedef PopupInitMessage
 * @property {Winfo} fgWinfo
 * @property {Winfo[]} bgWinfos
 * @property {Object<string, boolean>} flags
 */
/**
 * Request object sent as message from `(popup/request.js).action()` to `(background/message.js).INTERNAL.action()`
 * and then `(background/action.js).execute()` which passes it to smaller functions.
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
