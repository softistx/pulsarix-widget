# Integration guide

## Changing theme, locale and metadata at run time

Part of the host integration: the host switches its organisation, language or light/dark mode while a
reporter may have a dialog open. Never remount the widget for that (a remount drops the report being typed);
use the setters on the mount handle or on the script-tag global.

```ts
const widget = mount({ projectKey, apiBase, theme: "light", locale: "en" });

// the app's mode changed (resolve "Système" yourself, from the app's own state)
widget.setTheme(resolvedMode); // "light" | "dark" | "auto"

// the app's language changed
widget.setLocale("fr"); // "en" | "fr"

// the app's organisation changed: the next report carries these entries
widget.setMetadata({ org: orgId, plan });
widget.setMetadata(null); // none
```

```js
PulsarixWidget.setTheme("dark");
PulsarixWidget.setLocale("fr");
PulsarixWidget.setMetadata({ org: "acme" });
```

| Call                   | Effect                                                      | Kept                          |
| ---------------------- | ----------------------------------------------------------- | ----------------------------- |
| `setTheme(theme)`      | the widget's own light or dark mode, at once                | the open dialog and its draft |
| `setLocale(locale)`    | the strings re-render in that language                      | the open dialog and its draft |
| `setMetadata(entries)` | replaces the metadata of the next report (`null` clears it) | the open dialog and its draft |

Rules:

- `theme: "light" | "dark"` is honoured exactly. `"auto"` follows the operating system's
  `prefers-color-scheme`, never the host page's class or attribute. A host with its own mode switch passes the
  resolved `"light"` or `"dark"` to `setTheme` on each change.
- `setTheme` only sets the widget's own mode. The accent (`accentColor`) is a mount option and does not change.
- `setMetadata` replaces; it does not merge. The limits are those of `metadata` at mount (20 entries, keys of
  64 characters, values of 512, 2 KB in all). A report already sent is not changed.
- `setLocale` rebuilds the dialog's contents: the dialog stays open and the typed fields, the chosen type
  and the tab are kept, but files or a screenshot already attached are dropped (the i18n context of
  `@softistx/material/embed` reads its language once, so the tree is re-keyed). `setTheme` and `setMetadata`
  drop nothing.
- An unsupported theme or locale is ignored.
- Calls before the script-tag bundle has loaded are queued and replayed in order.
