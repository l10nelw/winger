# Winger - A Window Manager

Name windows, switch windows, move tabs between windows, and more. A Firefox web extension to fluidly operate multiple windows and organize tabs.

Install Winger from here: https://addons.mozilla.org/en-US/firefox/addon/winger/

## Naming conventions and terminology

- An info-about-a-window object is called a "winfo". Winfos live in the background frame's `Window.winfoMap`, acting as Winger's source-of-truth.
- A variable prefixed with `$` references a DOM node or a collection of DOM nodes. (Generally found in the popup and options frames.)
    - Some DOM nodes are given custom properties (a.k.a. expandos) prefixed with `_` or `$` for storing and passing around data.
- `active` tabs are "focused"; `highlighted` tabs are "selected".
