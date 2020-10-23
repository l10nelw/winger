# Winger - A Window Manager

Name windows, switch windows, and move tabs between windows. A Firefox web extension to fluidly operate multiple windows and organize tabs.

Install Winger from here: https://addons.mozilla.org/en-US/firefox/addon/winger/

## Release Notes

### v1.3.1

Improved: General optimizations; conditionally load optional features.

Dropped: [Panel] Live-updating tab counts (not very useful for a bunch of event listeners).

Fix: [Context menu] Simplified Send Tab To Window behaviour on unselected tab to be consistent.

Fix: [Settings] Make "Keep moved tabs selected" option a child of "Keep moved focused tab focused" option.


### v1.3

WinMan is now Winger.

New: Button badge displaying window name available.

New: Button tooltip includes window name.

New: [Panel] Current window name can be double-clicked to edit.

New: Settings page informs if Winger has private window access.

Improved: [Panel] Filtering sorts window names from shortest to longest.

Improved: [Context menu] Commands explicitly labelled; list of windows now sorted by last focused.

Improved: Tearing off tabs honours the "Keep moved tabs selected" setting.

Various cosmetic fixes and improvements to the panel and help page.


### v1.2.3-7

Fixed: Unable to arrow-navigate between ominbox and toolbar when there is only one window.

Fixed: Omnibox and toolbar heights in Windows.

Fixed: Panel width not accommodating scrollbar if it appears.

Fixed: Panel in edit mode wildly changing width when traversing rows.

Fixed: Settings not saving.

Fixed: 3-digit tab count pushing out edit button on a window row.


### v1.2.2

New: When the omnibox is not focused, typing instantly returns focus to it. No need to click or navigate back to it anymore.

Improved: Tab action buttons can be toggled all at once in settings.

Fixed: Janky panel opening, especially if slow to load. Now opens more smoothly.

Fixed: Unreliable arrow navigation when windows are filtered or some buttons are toggled off.


### v1.2.1

New: Enable or disable context menus in settings.

Fixed: Opening links with bring modifier did not work.

Fixed: Edit mode broke if Edit button removed.


### v1.2

New: Send tabs to other windows via tab context menu (right-click on tabs), and open links in other windows via link context menu (right-click on links).

New: In Edit Mode, status bar shows the title of the target window's focused tab, to help you identify the window.

New: Option to allow moving pinned tabs only if all selected tabs are pinned.

Fix: Settings page now has Apply Settings buttons to reload the add-on manually, instead of auto-reloading when a setting is changed which may not reliably preserve the view of the settings page.


### v1.1.1

Improved: Navigation by arrow keys invoked on key-down instead of key-up. Allows continuous movement when holding an arrow key down.

Improved: When invoking help, the help page that is switched to is also refreshed.


### v1.1

New: Intuitive panel navigation by arrow keys added, greatly improving keyboard accessibility.

Improved: Invoking help first checks if the help page is already open and switches to it. The help page is automatically opened when WinMan is installed for the first time.

Fixed: If a "bring" action fails to move any tabs (e.g. pinned), the window switch will not occur either.
