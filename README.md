# @softistx/pulsarix-widget

An intake widget that lets your users report a problem to your pulsarix project:
a title, a description and an optional e-mail, with no account. It renders inside a
Shadow DOM, so your page's styles and the widget's never touch.

## Install

The package is published on the private registry `npm.softistx.com`, not on npmjs. Point the
`@softistx` scope at it in your `.npmrc`, with a read token exported as `NPM_REGISTRY_TOKEN`:

```ini
@softistx:registry=https://npm.softistx.com/
//npm.softistx.com/:_authToken=${NPM_REGISTRY_TOKEN}
```

```sh
npm install @softistx/pulsarix-widget
```

The `mount()` route below is for apps with access to that registry. Third-party sites use the
script tag served by the pulsarix host and install nothing. The package has no dependencies and
ships its own types. The bundle is about 1 MB un-gzipped (about 270 KB gzipped): React is inlined
and isolated in the widget's shadow root, so it never clashes with the page's own React.

## Usage

### Script tag

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx"></script>
```

Attributes (all optional but the key): `data-locale` (`en` default, `fr`), `data-theme`
(`light`, `dark`, `auto` default), `data-position` (`bottom-right` default, `bottom-left`),
`data-accent-color` (a hex seed for the theme; without it the widget wears material's built-in `lavande` theme), `data-api-base` (the
pulsarix origin; defaults to the host that served the loader), `data-launcher="false"` (no
floating button; open it with `window.PulsarixWidget.open()`), `data-mask-text="true"` (the
"Mask the text on the page" screenshot option starts on; see "Screenshots"), `data-attachments="false"`
(no screenshot and no file controls; see "Attached files"), `data-privacy-url` (an http(s) link to your
own privacy page, shown after the privacy line), `data-prefill-email` and `data-prefill-title` (starting
values of the form), `data-metadata` (a JSON object of strings stored with each report: at most 20 entries,
keys of 64 characters, values of 512, 2 KB in all; the rest is dropped).

In script, the same are `privacyUrl`, `prefill: { email, title }` and `metadata: { plan: "pro" }`.
What the reporter typed is kept when the dialog is closed by accident (a click outside, Escape) and comes
back at the next opening; a sent report clears it.

Without the attributes, drive it from script. Calls made before the bundle has loaded are queued, and a second `init` while loaded is ignored:

```js
PulsarixWidget.init({ projectKey: "pk_live_xxx", locale: "fr" });
const off = PulsarixWidget.on("pulsarix:submit", (e) => console.log(e.detail.reportId));
PulsarixWidget.open();
// later
off();
PulsarixWidget.destroy();
```

### npm

```ts
import { mount } from "@softistx/pulsarix-widget";

const widget = mount({
  projectKey: "pk_live_xxx",
  apiBase: "https://<pulsarix-host>", // required on the npm route
  accentColor: "#0b7a75",
});
widget.on("pulsarix:open", () => console.log("opened"));
widget.open();
```

`apiBase` is required here: only the script tag can infer it (from where the loader was
served). Without it the form reports a configuration error instead of sending.

The module is browser-only. Importing it registers `<pulsarix-widget>` and needs `HTMLElement`
and `customElements`, so in an SSR framework import it on the client only:

```ts
const { mount } = await import("@softistx/pulsarix-widget"); // inside an effect, never at module top level
```

One widget per page: a second `mount` while one is attached warns and returns the first
handle. To mount again, destroy first:

```ts
widget.destroy();
const next = mount({ projectKey: "pk_live_xxx", apiBase: "https://<pulsarix-host>", locale: "fr" });
```

A script-tag loader and an npm import are two separate instances: use one route per page.

### Exports

`mount`, `defineWidget` (registers the element; `mount` calls it), `PulsarixWidgetElement`,
`TAG_NAME` (`"pulsarix-widget"`), and the types `MountOptions`,
`WidgetHandle`, `WidgetEvent`, `WidgetConfig`, `Locale`, `Position`, `ThemeMode`.

| `MountOptions` | Type | Default |
| --- | --- | --- |
| `projectKey` | `string` | required; missing reports `pulsarix:error` `config` |
| `apiBase` | `string` | none; required on the npm route |
| `locale` | `"en" \| "fr"` | `"en"` |
| `theme` | `"light" \| "dark" \| "auto"` | `"auto"` |
| `position` | `"bottom-right" \| "bottom-left"` | `"bottom-right"` |
| `accentColor` | hex string | none: the built-in `lavande` theme |
| `launcher` | `boolean` | `true` (`false` hides the floating button) |
| `target` | `Element` | `document.body` |

`WidgetHandle`: `open()`, `close()`, `destroy()`, `on(name, callback)` (returns the function that
unsubscribes) and `element`, the `<pulsarix-widget>` (`element.isOpen`, `element.config`).

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
  (404, or a readable 403: sending stops), a rate limit (429, with the wait), a refused report
  (400), a network failure, a missing key or base. A page whose origin the key does not allow
  gets an answer without CORS headers, which the browser hides from the widget: it shows as a
  network failure (`pulsarix:error` with `network`), and the text tells the reader to ask the
  site owner whether reports are enabled there.
- Locales: English (default) and French, from `locale`. The page address (origin and path only,
  never the query string or the fragment), the browser and the e-mail (if given) are sent with
  the report; the form says so.

## Screenshots

A report can carry one optional screenshot, never taken without a click (and a per-report
choice). The right pane of the dialog offers:

- **Add a screenshot**: the browser's screen capture (`getDisplayMedia`). The widget hides itself
  (`visibility`, not unmount, so the form keeps its text) while the frame is grabbed, then shows
  itself again. Not offered on a phone, without the API, or under a Permissions-Policy that blocks
  `display-capture`.
- **Upload an image**: always offered, and the only choice where capture is unavailable or was
  refused. PNG, JPEG or WebP, 25 megapixels at most.
- **Mask the text on the page** (off by default; `data-mask-text="true"`, or `maskText: true` in `init` / `mount`, turns it on when the dialog opens): covers the
  page's text with opaque boxes before the picture is taken. It needs the current tab to be shared;
  otherwise the widget says it cannot and nothing is captured. Mark anything that must stay visible
  with `data-capture-unmask`.

The picture opens in an editor (a separate chunk, fetched when first needed) with a pen, a highlighter,
an arrow, a box, text and a solid "Redact" box: redacted pixels are one opaque colour. Only the flattened
export (2560 px on its longest side at most) is kept; the raw capture is dropped, its object URLs
revoked and no media track stays live. Retake and Remove are offered. A report is complete without
any of this. No `blob:` image source is needed in your CSP (the editor draws on canvases), and a
`Permissions-Policy` without `display-capture` turns the capture button off.

Events, on the element and through `on(name, cb)`: `pulsarix:ready` (asynchronous, in a microtask,
so a listener added right after `mount()` hears it; it fires even when the key is missing, then
`pulsarix:error` with `config` follows), `pulsarix:open`,
`pulsarix:close`, `pulsarix:submit` (`detail: { reportId, files }`, one `{ name, role, type, size,
uploaded }` per file sent with the report) and `pulsarix:error`
(`detail: { code }`, the API's `intake.errors.*` code, or `network`, `config`, `http-<status>`).

```ts
widget.on("pulsarix:submit", (event) => console.log(event.detail.reportId));
widget.on("pulsarix:error", (event) => console.warn(event.detail.code));
```

## Attached files

Besides the screenshot, a reporter can attach up to 3 files (PNG, JPEG, WebP or PDF, 5 MB each,
12 MB for the report, screenshot included) by dropping them on the zone or with Browse. The
checks mirror the API's, so a refused file is shown with its reason and never sent; the list shows
each file's type icon, name, size, a thumbnail for images, a Remove button, and its progress while
the report goes out.

- On submit the widget declares the files to `submitClientReport`, then PUTs each one to the signed
  single-use ticket the API answers (`/public/media/report-files/<slot>`), with progress, and one
  retry on a network failure or a 5xx. The report itself is already saved by then: if a file
  cannot be attached, the confirmation says "Your report was sent, but N of M files could not be
  attached" and `pulsarix:submit` lists that file with `uploaded: false`.
- Off for one embed with `data-attachments="false"` (`attachments: false` in `init` / `mount`), and
  off for a key when its project switches attachments off (`widgetConfig.attachments`); the
  screenshot pane goes with them.
- The files go to the same origin as the report, so `connect-src` is unchanged. Thumbnails are
  drawn on canvases, so no `img-src blob:` is needed. Capture needs `display-capture` in the
  host's `Permissions-Policy` (the upload of an image works without it).
- The list's own labels (the "Attachments" name, "Remove") come from `@softistx/material/embed`
  and follow the widget's locale through `I18nProvider`, like every refusal and the confirmation.
- An API that sends no `attachments` in `widgetConfig`, or a failed config read, shows no file
  controls (the widget then behaves as v1).

## How it is isolated

- `<pulsarix-widget>` has an open shadow root. `@softistx/material/embed` (the lean entry for
  Shadow DOM widgets: no globals, only the parts the form uses) and its `embed.css`, plus the
  theme (the built-in `lavande`, or one generated from `accentColor`), are adopted into it (`adoptedStyleSheets`): no style
  element, no `style-src 'unsafe-inline'`. Portals (the dialog) target an element inside it.
- The page's styles do not reach the widget. Only `color-scheme` and the root font size
  inherit: `:host` resets `color-scheme`, and `embed.css` is already in `px` with its
  `@property` initial values as plain declarations (a shadow root ignores `@property`). The build
  adds the utilities the widget's own classes need, with their `@property` values copied the same way.
- The widget leaves the page as it found it: no global but `window.PulsarixWidget`. While the
  modal is open, the dialog's scroll lock adds a transient style element and focus guards
  to the document; both are removed on close.
- Fonts: `@font-face` is ignored in a shadow root. The widget uses the system font stack.

## Serving (script-tag integrators)

The pulsarix host serves `/widget/v1/loader.js` (short cache) and the hashed bundle it imports
(long cache). The bundle needs `Access-Control-Allow-Origin: *`. Your CSP needs `script-src` and
`connect-src` for the pulsarix host.
