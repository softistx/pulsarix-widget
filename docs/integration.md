# Integrating the widget

## Inheriting the host app's theme

When the host app is built on `@softistx/material`, the widget wears the host's theme (its
colours, radius and light or dark mode) instead of its own `lavande` one, and follows the host
when the user changes theme. Nothing to configure: `inheritTheme` is `true` by default.

```ts
mount({ projectKey: "pk_live_xxx", apiBase: "https://pulsarix.example.com" });
// the host's theme picker, dark mode and primary now apply to the dialog

mount({ projectKey: "pk_live_xxx", inheritTheme: false }); // the widget's own look, as before
```

Script tag: `data-inherit-theme="false"`. Element attribute: `inherit-theme="false"`.

### How it works

The widget lives in a shadow root and declares its own tokens there, so the page's custom
properties cannot reach it by plain CSS inheritance. Instead, the widget reads the host's tokens
from `getComputedStyle(document.documentElement)` and sets the valid ones on its own root as
inline custom properties:

- **Which tokens**: the literal colours of the built-in theme (`--primary`, `--background`,
  `--foreground`, `--card`, `--border`, `--muted`, `--error`, ...), `--radius` and the few
  percentage tokens. Tokens the theme derives from others (`--ground`, `--primary-text`, ...)
  are recomputed by the widget from the inherited ones. Fonts are never inherited: the widget
  keeps the system font stack.
- **Fallback**: a token that is missing, empty or not valid (a colour the browser rejects, a
  length that is not `px` or `rem`) keeps the widget's own value. A host that is not on
  `@softistx/material`, or whose tokens are bare HSL triplets (`222 47% 11%`), therefore looks
  exactly as before. `rem` radii are converted to `px` with the host's root font size.
- **Light and dark**: the inherited values are the host's current mode's, so the widget's scheme
  follows the host's: its `dark` / `light` class on `<html>`, else its `color-scheme`. When the
  host says neither, the `theme` option decides as before.
- **`accentColor` wins**: with an explicit `accentColor`, the host's primary family
  (`--primary`, `--primary-foreground`, `--inverse-primary*`) is not inherited; the other tokens
  still are.
- **Follows the host**: a `MutationObserver` on `<html>` (`class`, `style`, `data-theme`,
  `data-mode`, `data-nxgt-theme`, `data-color-scheme`) and the `prefers-color-scheme` media query
  re-read the tokens. It stops when the widget is removed (`destroy()`).

### Limits

- The tokens are read from `<html>`. A host that scopes its theme to a wrapper element (not
  `<html>`) is not read: the widget keeps its own look.
- Custom properties set at run time through a host's stylesheet swap (a new `<link>`) without an
  attribute change on `<html>` are picked up at the next attribute change or scheme change.
- Pairing: the inherited colours are the host's own, so the widget is as readable as the host.
  Mixing a few inherited tokens with the widget's own for the rest (a partial host theme) can
  lower contrast; set `inheritTheme: false` when the host only defines part of the palette.
