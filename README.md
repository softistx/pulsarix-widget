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

A second `init` while loaded is ignored.

## The report form

The launcher opens a dialog with a title, a description and an optional e-mail. With an e-mail,
the reporter is mailed a link to follow the report. The dialog traps focus, closes on Escape
and returns focus to the launcher (or to whatever opened it).

- The form posts the persisted `submitClientReport` operation to `<apiBase>/public/graphql`.
  The script tag fills `apiBase` with the origin that served the loader; override it with
  `data-api-base` (or `apiBase` in `init` / `mount`, `api-base` on the element). Without one
  (an npm `mount` that gives none), the form reports a configuration error instead of sending.
- The project key must allow the page's origin (plain `http` only on `localhost`). A form sent
  faster than 3 seconds after it opened waits out the difference, because the API refuses it.
- Failures are shown in the dialog and the text is kept: the service busy (503), a rejected key
  or origin (404, 403: sending stops), a rate limit (429, with the wait), a refused report
  (400), a network failure, a missing key or base.
- Locales: English (default) and French, from `locale`. The page address, the browser and the
  e-mail (if given) are sent with the report; the form says so.

Events, on the element and through `on(name, cb)`: `pulsarix:ready`, `pulsarix:open`,
`pulsarix:close`, `pulsarix:submit` (`detail: { reportId }`) and `pulsarix:error`
(`detail: { code }`, the API's `intake.errors.*` code, or `network`, `config`, `http-<status>`).

```ts
widget.on("pulsarix:submit", (event) => console.log(event.detail.reportId));
widget.on("pulsarix:error", (event) => console.warn(event.detail.code));
```

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
