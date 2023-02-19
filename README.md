# Winger - A Window Manager

Name windows, switch windows, move tabs between windows, and more. A Firefox web extension to fluidly operate multiple windows and organize tabs.

Install Winger from here: https://addons.mozilla.org/firefox/addon/winger/

## Naming conventions

- A variable prefixed with a `$` sigil represents a DOM node or a collection of DOM nodes. (Generally found in the popup and options frames.)
    - Some DOM nodes are given custom properties (a.k.a. expandos) prefixed with `_` or `$`.
- `active` tabs are "focused"; `highlighted` tabs are "selected".
