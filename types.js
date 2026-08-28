/** @typedef {string} BNodeId */
/** @typedef {string} ExtensionId */
/** @typedef {number} GroupId */
/** @typedef {number} TabId */
/** @typedef {number} WindowId */

/** @typedef {'Badge' | 'TitlePreface'} ChromeComponentName */
/** @typedef {object.<ExtensionId, string[]>} SubscriptionDict - ExtensionIds mapped to property arrays */
/** @typedef {'user' | 'system'} UpdateSource */
/** @typedef {Iterable<[WindowId, string]>} WindowIdNamePairs */

// Approximations of officially-documented entities, listing only properties relevant to this app.
/**
 * Simulates `browser.windows.Window`.
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/Window}
 * @typedef Window
 * @property {boolean} focused
 * @property {WindowId} id - Required because we don't need to deal with id-less `browser.sessions.getRecentlyClosed()` windows.
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
 * @property {number} [stashId] - Added by `(stash.prop.js).Parents.prepare()`, used by `(stash.prop.js).Props.TAB.writer.id/parentId()`
 * @property {number} [stashParentId] - Added by `(stash.prop.js).Parents.prepare()`, used by `(stash.prop.js).Props.TAB.writer.id/parentId()`
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

// Proto-entities: collections of properties used for creating/updating the respective entities.
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create}
 * @typedef {Partial<Omit<Window, 'id'|'tabs'|'title'>> & _ProtoWindow} ProtoWindow
 * @typedef _ProtoWindow
 * @property {boolean} [preserve] - Used by `(stash.unstash.js).UnstashFolder()`
 * @property {string} [titlePreface]
 */
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/create}
 * @typedef {Partial<Omit<Tab, 'id'>> & _ProtoTab} ProtoTab
 * @typedef _ProtoTab
 * @property {ProtoGroup} [group] - Added by `(stash.prop.js).Groups.prepare()`, used by `(stash.prop.js).Props.TAB.writer.group()`
 * @property {boolean} [muted]
 * @property {boolean} [openInReaderMode]
 */
/**
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/update}
 * @typedef {Partial<Group> & _ProtoGroup} ProtoGroup
 * @typedef _ProtoGroup
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
 * Type is spelled "WInfo" to not conflict with module "Winfo".
 * @typedef {Partial<Window> & _WInfo} WInfo
 * @typedef _WInfo
 * @property {WindowId} id
 * @property {EpochTimeStamp} [firstSeen]
 * @property {string} [givenName]
 * @property {EpochTimeStamp} [lastFocused]
 * @property {boolean} [minimized]
 * @property {string} [name] - alias of givenName
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
 * @property {WInfo} fgWinfo
 * @property {WInfo[]} bgWinfos
 * @property {import('./storage').PopupConfig} config
 */
/**
 * @typedef WindowUpdatedMessage
 * @property {'updated'} type
 * @property {UpdateSource} source
 * @property {WInfo[]} windows
 */
/**
 * Request object sent as message from `(popup/request.js).action()`, to `(background/background.message.js).INTERNAL.action()`,
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
