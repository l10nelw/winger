
<div align="right">
  <details>
    <summary >🌐 Language</summary>
    <div>
      <div align="center">
        <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=en">English</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=zh-CN">简体中文</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=zh-TW">繁體中文</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=ja">日本語</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=ko">한국어</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=hi">हिन्दी</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=th">ไทย</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=fr">Français</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=de">Deutsch</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=es">Español</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=it">Italiano</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=ru">Русский</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=pt">Português</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=nl">Nederlands</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=pl">Polski</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=ar">العربية</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=fa">فارسی</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=tr">Türkçe</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=vi">Tiếng Việt</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=id">Bahasa Indonesia</a>
        | <a href="https://openaitx.github.io/view.html?user=l10nelw&project=winger&lang=as">অসমীয়া</
      </div>
    </div>
  </details>
</div>

# Winger - A Window Manager

Name windows, switch windows, move tabs between windows, and more. A Firefox web extension to fluidly operate multiple windows and organize tabs.

Install Winger from here: https://addons.mozilla.org/firefox/addon/winger/

## Code and documentation conventions

### Terminology

- `active` tabs are "focused"
- `highlighted` tabs are "selected"

### Variable names

- Most variables and functions are camelCased
- Classes, modules and namespace objects (which group related functions together, hardcoded) are usually PascalCased
- Hardcoded constants are usually UPPER_SNAKE_CASED
- Storage keys are usually lower_snake_cased
- Arrays are usually plural
- Objects are usually singular
- Objects that serve to group things together (as opposed to representing a thing) are usually suffixed with `Dict`
- Object properties that are only referenced inside their object are usually prefixed with `_`
- Maps are usually suffixed with `Map`
- Sets are usually suffixed with `Set`
- Booleans are usually prefixed with words like `is` and `has`
- DOM nodes and collections of DOM nodes are usually prefixed with `$`
- Custom properties (a.k.a. expandos) in standard built-in objects (e.g. Arrays, DOM nodes) are prefixed with `_`, or `$` if referencing DOM nodes
