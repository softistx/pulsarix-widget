# @softistx/pulsarix-widget

An intake widget that lets your users report a problem to your pulsarix project:
a title, a description and an optional e-mail, with no account. It renders inside a
Shadow DOM, so your page's styles and the widget's never touch.

## Usage

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx"></script>
```

Attributes (all optional but the key): `data-locale` (`en` default, `fr`), `data-theme`
(`light`, `dark`, `auto` default), `data-position` (`bottom-right` default, `bottom-left`),
`data-accent-color` (a hex seed for the theme, `#4f46e5` by default), `data-launcher="false"`
(no floating button; open it with `window.PulsarixWidget.open()`).

```ts
import { mount } from "@softistx/pulsarix-widget";

const widget = mount({ projectKey: "pk_live_xxx", accentColor: "#0b7a75" });
widget.on("pulsarix:open", () => console.log("opened"));
widget.open();
```

Status: W0 foundation. The element, the shadow root, the theme and the loader work; the
report form and the submit arrive with W1.

## How it is isolated

- `<pulsarix-widget>` has an open shadow root. `@softistx/material`'s compiled stylesheet and
  the theme generated from `accentColor` are adopted into it (`adoptedStyleSheets`): no style
  element, no `style-src 'unsafe-inline'`. Portals (the dialog) target an element inside it.
- The page's styles do not reach the widget. Only `color-scheme` and the root font size
  inherit, and both are neutralised: `:host` resets `color-scheme`, and the build converts
  `rem` to `px` (a shadow root cannot reset `html { font-size }`) and copies `@property`
  initial values into a lowest-priority layer (a shadow root ignores `@property`).
- The widget leaves the page as it found it: no global but `window.PulsarixWidget`. While the
  modal is open, the dialog's scroll lock adds a transient style element and focus guards
  to the document; both are removed on close.
- Fonts: `@font-face` is ignored in a shadow root. The widget uses the system font stack.

## Serving (plan section 13)

`bun run build` writes `dist/loader.js` (short cache), `dist/widget.<hash>.js` (long cache,
immutable) and `dist/manifest.json`. The loader imports the hashed file from its own
directory with `import()`, so the host serving `/widget/v1/` must send
`Access-Control-Allow-Origin: *` on the bundle. Integrators need `script-src` and `connect-src`
for the pulsarix host.

## Develop

```sh
bun run verify        # lint, build, typecheck, unit tests, loader size (at most 5 KB gzipped)
bun run test:browser  # the host-fixture leak test in Chromium (local only, not in CI)
bun run capture <dir> # 360 and 1440 px, light and dark, widget open
```

The contract (config, events, Shadow DOM, CSP) is in [../docs/plan.md](../docs/plan.md) section 10.
