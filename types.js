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
 * @typedef ProtoWindow - browser.windows.create() argument object
 * @property {boolean} [focused]
 * @property {boolean} [incognito]
 * @property {string} [state]
 * @property {string} [titlePreface]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create}
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
 * @typedef ProtoTab - browser.tabs.create() argument object
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
 * @typedef ProtoGroup - browser.tabGroups.update() argument object
 * @property {boolean} [collapsed]
 * @property {string} [color]
 * @property {string} [title]
 * @property {number} [id] - groupId at stash time
 * @property {TabId[]} [tabIds] - Added and used by (/background/stash.prop.js).Groups.restore()
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabGroups/update}
 */
/** @typedef {string} NodeId */
/**
 * @typedef Node
 * @property {Node[]} [children]
 * @property {NodeId} id
 * @property {number} index
 * @property {NodeId} parentId
 * @property {string} type
 * @property {string} [title]
 * @property {string} [url]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/BookmarkTreeNode}
 */
/**
 * @typedef ProtoNode - browser.bookmarks.create() argument object
 * @property {number} [index]
 * @property {NodeId} [parentId]
 * @property {string} [title]
 * @property {string} [type]
 * @property {string} [url]
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/bookmarks/CreateDetails}
 */

export {}
