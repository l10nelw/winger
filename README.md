# Winger - A Window Manager

Name windows, switch windows, move tabs between windows, and more. A Firefox web extension to fluidly operate multiple windows and organize tabs.

Install Winger from here: https://addons.mozilla.org/firefox/addon/winger/

## Code and documentation conventions

### Terminology

- `active` tabs are "focused"
- `highlighted` tabs are "selected"

### Variable names

- Arrays are usually plural
- Objects are usually singular
- Objects that group similar things together are usually suffixed with `Dict`
- Maps are usually suffixed with `Map`
- Sets are usually suffixed with `Set`
- Booleans are usually prefixed with words like `is` and `has`
- Classes, modules and namespace objects are usually PascalCased
- DOM nodes and collections of DOM nodes are usually prefixed with `$`
- DOM node custom properties (a.k.a. expandos) are prefixed with `_`, or `$` if referencing DOM nodes