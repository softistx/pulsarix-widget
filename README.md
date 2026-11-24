# @softistx/pulsarix-widget

An intake widget that lets your users report a problem to your pulsarix project:
a title, a description and an optional e-mail, with no account. It renders inside a
Shadow DOM, so your page's styles and the widget's never touch.

## Install

The package is published on npmjs with restricted access: installing it needs an npm read token for
the `@softistx` scope. Point the scope at npmjs with the token read from an environment variable
(never commit its value).

In `bunfig.toml` (Bun):

```toml
[install.scopes]
"@softistx" = { url = "https://registry.npmjs.org", token = "$NPM_SOFTISTX_READ_TOKEN" }
```

Or in `.npmrc` (npm, pnpm, yarn):

```ini
@softistx:registry=https://registry.npmjs.org
//registry.npmjs.org/:_authToken=${NPM_SOFTISTX_READ_TOKEN}
```

Then:

```sh
export NPM_SOFTISTX_READ_TOKEN=<your read token>
npm install @softistx/pulsarix-widget
```

The `mount()` route below is for apps that install the package. Third-party sites use the
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
(`light`, `dark`, `auto` default), `data-launcher-side` (`right` default, `left`) and `data-launcher-offset` (a fraction from 0, top, to 1, bottom; `0.5` default),
`data-accent-color` (a hex seed for the theme; without it the widget wears the host's `@softistx/material` theme, else material's built-in `lavande`), `data-inherit-theme="false"` (never inherit the host's theme; see "Theme"), `data-api-base` (the
pulsarix origin; defaults to the host that served the loader), `data-launcher="false"` (no
floating button; open it with `window.PulsarixWidget.open()`) or `data-launcher="auto|pill|icon"`
(any value other than `false` gives the edge tab; see "The launcher"), `data-mask-text="true"` (the
"Mask the text on the page" screenshot option starts on; see "Screenshots"), `data-attachments="false"`
(no screenshot and no file controls; see "Attached files"), `data-privacy-url` (an http(s) link to your
own privacy page, shown after the privacy line), `data-prefill-email` and `data-prefill-title` (starting
values of the form), `data-metadata` (a JSON object of strings stored with each report: at most 20 entries,
keys of 64 characters, values of 512, 2 KB in all; the rest is dropped).

`data-identity` (the signed token of the signed-in user, see "Identified reporters"), changed later with
`PulsarixWidget.identify(token)` and `PulsarixWidget.identify(null)` at sign-out.

In script, the same are `identity`, `privacyUrl`, `prefill: { email, title }` and `metadata: { plan: "pro" }`.
What the reporter typed is kept when the dialog is closed by accident (a click outside, Escape) and comes
back at the next opening; a sent report clears it.

Without the attributes, drive it from script. Calls made before the bundle has loaded are queued, and a second `init` while loaded is ignored:

```js
PulsarixWidget.init({ projectKey: "pk_live_xxx", locale: "fr" });
const off = PulsarixWidget.on("pulsarix:submit", (e) =>
  console.log(e.detail.reportId),
);
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
const next = mount({
  projectKey: "pk_live_xxx",
  apiBase: "https://<pulsarix-host>",
  locale: "fr",
});
```

A script-tag loader and an npm import are two separate instances: use one route per page.

### Exports

Server helper: `@softistx/pulsarix-widget/server` exports `signPulsarixIdentity` and the type `SignPulsarixIdentityOptions` (see "Signing the identity on your server").

`mount`, `defineWidget` (registers the element; `mount` calls it), `PulsarixWidgetElement`,
`TAG_NAME` (`"pulsarix-widget"`), and the types `MountOptions`,
`WidgetHandle`, `WidgetEvent`, `WidgetConfig`, `Locale`, `ThemeMode`, `LauncherMode`,
`LauncherPlacement`, `LauncherSide`.

| `MountOptions` | Type                                                          | Default                                                    |
| -------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| `projectKey`   | `string`                                                      | required; missing reports `pulsarix:error` `config`        |
| `apiBase`      | `string`                                                      | none; required on the npm route                            |
| `locale`       | `"en" \| "fr"`                                                | `"en"`                                                     |
| `theme`        | `"light" \| "dark" \| "auto"`                                 | `"auto"`                                                   |
| `accentColor`  | hex string                                                    | none: the built-in `lavande` theme                         |
| `inheritTheme` | `boolean`                                                     | `true`: wear the host's `@softistx/material` theme         |
| `launcher`     | `boolean \| "auto" \| "pill" \| "icon" \| { side?, offset? }` | `{ side: "right", offset: 0.5 }` (`false` removes the tab) |
| `identity`     | `string \| null`                                              | none: today's form only (see "Identified reporters")       |
| `target`       | `Element`                                                     | `document.body`                                            |

`WidgetHandle`: `open()`, `close()`, `setLauncherVisible(visible)`, `holdLauncher()` (returns a release function), `destroy()`, `identify(token \| null)`, `setTheme(theme)`, `setLocale(locale)`,
`setMetadata(metadata \| null)` (see "Changing theme, locale and metadata at run time"), `on(name, callback)` (returns the function that
unsubscribes) and `element`, the `<pulsarix-widget>` (`element.isOpen`, `element.config`).

## Changing theme, locale and metadata at run time

When your app switches organisation, language or light/dark mode, do not remount the widget: a remount loses
a report being typed. Call the setters instead. Each applies live, keeps the dialog open and keeps what the
reporter typed.

```ts
widget.setTheme("dark"); // "light" | "dark" | "auto"
widget.setLocale("fr"); // "en" | "fr": the strings re-render
widget.setMetadata({ org: "acme", plan: "pro" }); // replaces the metadata of the next report; null clears it
```

The same three exist on the script-tag global (`PulsarixWidget.setTheme("dark")`, ...); a call made before the
bundle has loaded is queued. An unsupported theme or locale is ignored.

- `"auto"` follows the operating system (`prefers-color-scheme`), not your page's own mode. To follow your
  app's Clair / Sombre / Système switch, pass the resolved `"light"` or `"dark"` to `setTheme` whenever it changes.
- With `inheritTheme`, `setTheme("light" | "dark")` wins over the host's mode and `"auto"` gives it back to the
  host; inherited colour tokens still win for their value.
- `setMetadata` replaces the whole object (same limits as `metadata` at mount); a report already sent keeps
  the metadata it was sent with.
- `setLocale` changes the widget's own strings at once. The built-in labels of `@softistx/material` follow
  when the form is next idle: on an idle form the typed fields, the type and the impact are kept
  and files or a screenshot already attached are dropped; while a report is being sent, on the confirmation
  or in the "My requests" view nothing is rebuilt (and nothing is lost), and those labels switch once the
  reporter is back on the form or the dialog closes.
- A repeated call before the bundle loads replaces the earlier one: only the last of each setter runs.
- With `inheritTheme`, an explicit `setTheme` wins over the host's mode until the `theme` attribute is
  written again; see [docs/integration.md](docs/integration.md#10-changing-theme-locale-and-metadata-at-run-time).

## Theme

The widget wears the host app's `@softistx/material` theme (colours, radius, light or dark) when the host has
one, and follows its theme picker; its own `lavande` values (or `accentColor`) are the fallback for every token
the host lacks. `inheritTheme: false` (`data-inherit-theme="false"`) keeps the widget's own look. How it
works, and its limits: [docs/integration.md](docs/integration.md#9-inheriting-the-host-apps-theme).

## The launcher

The launcher is an **edge tab**: a 44 x 44 px icon button docked flush to the viewport edge, rounded on the
content side only, with the pulsarix mark and the unread badge. At rest it peeks 6 px less; it slides fully
in on hover, focus and while it is dragged. Its label is a tooltip only (hover or keyboard focus, hidden
while dragging and on touch screens), and its accessible name carries the unread count ("Report a
problem, 2 unread requests"). Without an identity token a click opens the report form; with one it opens a
menu with "Report a problem" and "My requests" (unread badge).

You choose where it starts, `launcher: { side: "right" | "left", offset: 0..1 }` (`offset` is a fraction of
the free height, `0.5` by default; script tag: `data-launcher-side`, `data-launcher-offset`). The reporter can move it
along the edge: by dragging it, or with Alt+ArrowUp / Alt+ArrowDown (each move is announced). Their
position is saved in `localStorage` for your origin and wins over your starting point; it stays inside the
viewport, also when the window is resized. A drag never opens the dialog.

`false` removes the tab (`"auto"`, `"pill"` and `"icon"` are still read and give the default tab). With the
launcher removed or held hidden, an identified reporter has no way to the requests list: keep it visible for them.
`setLauncherVisible(false)` hides only the launcher, never an open dialog, and `holdLauncher()` hides it the same way while a host's own sticky bar is up (ref-counted, call the returned function to release); with the script tag it is
`window.PulsarixWidget.setLauncherVisible(false)`. Details and examples:
[docs/integration.md](docs/integration.md).

### Migrating from 0.6 (breaking)

The floating round button, its `position` and its offsets are gone:

| 0.6                                                      | Now                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `position: "bottom-left"` / `data-position`              | `launcher: { side: "left" }` / `data-launcher-side="left"`                                        |
| `offset: { bottom: 88 }` / `data-offset-bottom`          | `launcher: { offset: 0.4 }` / `data-launcher-offset="0.4"` (a fraction of the height, not pixels) |
| `offset.side` / `data-offset-side`                       | removed: the tab is flush to the edge                                                             |
| `--pulsarix-launcher-bottom`, `--pulsarix-launcher-side` | removed: no longer read                                                                           |
| `LauncherOffset`, `Position` types                       | `LauncherPlacement`, `LauncherSide`                                                               |

A host that reserved space for the round button (a right padding, say) no longer needs it: the tab is 44 px
wide, sits on the edge and the reporter can move it out of the way. To clear a sticky bar, use
`holdLauncher()`.

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

## Identified reporters

Give the widget the token your server signed for the signed-in user (see "Signing the identity on your server"; `data-identity`,
`identity` in `init` / `mount`, or `PulsarixWidget.identify(token)` after sign-in; call
`identify(null)` at sign-out). The secret that signs the token stays on your server and never
reaches the browser; the widget only sends the token, in the `x-pulsarix-identity` header, and
never in a URL. A malformed token is ignored. A token given with `identify()` or `mount({ identity })`
is kept in the widget's memory and is not written to the page; a token in `data-identity` is an
attribute of the element, so it is visible in the DOM (prefer `identify()` when that matters).

- Without a token the dialog is the one report form, and the e-mail field is asked.
- With one, the tab opens a menu with "Report a problem" and "My requests" (no e-mail field). My requests is its own view, with its own title, and one list with
  filter chips and their counts (Open by default, Resolved, Declined, All); requests with
  unread replies come first, and the list is read again each time the dialog opens.
- The tab (in its name) and the My requests menu item show the unread count.
- Opening a request shows its thread: the original message, then the replies of the team (plain
  text, with their file names). The reporter can reply, with up to three files sent the same way as
  a report's (the ticket upload below), resolve the request, and reopen a resolved one for 30 days.
  A declined request is read-only and shows its reason. Opening a thread marks it read.
- While a thread is open the widget reads `GET /public/live/requests` with `fetch` (the identity in
  the header; an `EventSource` cannot send one) so a team reply appears at once, and stops reading
  when the thread closes. The page's CSP needs `connect-src` for the widget's API origin only.
- **Expired or refused token**: when the API refuses the token (a 401 on a read, a 401 or 403 on
  the live stream) or the stream ends with `expired`, the list or the open thread shows the session-expired message and the page hears `pulsarix:error` once with the code
  (`intake.errors.identity-invalid`,
  `intake.errors.identity-expired` or `http-<status>`). Call `identify(newToken)` to sign in again.
  The live stream reconnects after a drop with a pause that doubles up to 30 s, and never after
  `expired`, a 401, 403, 404 or 429.
- **E-mails about my requests**: a switch at the foot of My requests, on or off as the API
  says (`emailsOn`). It flips at once and is sent to the API (`setRequestEmails`); if that fails it
  goes back with a message. The choice applies to every request of the reporter under your key.
- **Delete my data**: a button at the foot of My requests opens a confirmation (Cancel on the
  left, Delete on the right). Confirming erases every request of the reporter under your key
  (`eraseMyData`), with their replies and files; the list is emptied, the dialog says how many
  were erased and the unread count goes to 0. A refusal (expired token, rate limit) keeps the
  confirmation open with the reason. Erasing cannot be undone. The page hears
  `pulsarix:erase` with `detail: { requests }`, the number of requests erased, followed by
  `pulsarix:unread` with `{ count: 0 }`.
- A token the API refuses (expired or forged) shows a message in My requests; reload the page
  to get a fresh one.
- Everyone (identified or not) can give an optional type (bug, question, suggestion) and an
  impact (blocking, annoying, minor) in the form's Details group.

## Signing the identity on your server

`@softistx/pulsarix-widget/server` signs the token for you, so you never hand-write the HMAC. It is
server-only (`node:crypto`, works on Node and Bun) and is a separate file: the browser bundle and the
loader never contain it. Never import it in client code.

```ts
import { signPulsarixIdentity } from "@softistx/pulsarix-widget/server";

const token = signPulsarixIdentity({
  secret: process.env.PULSARIX_IDENTITY_SECRET!, // shown once in pulsarix; keep it on the server
  publicKey: "pk_live_xxx", // the widget key's public key
  sub: user.id, // 1 to 200 characters, stable per user
  email: user.email, // optional, at most 254 characters
  name: user.name, // optional, at most 100 characters
  // ttlSeconds: 3600, // default 1 hour; 24 hours (86400) at most
});
```

| Option       | Type           | Notes                                                                |
| ------------ | -------------- | -------------------------------------------------------------------- |
| `secret`     | `string`       | required; used as the raw string, as the API does                    |
| `publicKey`  | `string`       | required; the token's audience                                       |
| `sub`        | `string`       | required; 1 to 200 characters; never stored, only its digest per key |
| `email`      | `string`       | a valid address                                                      |
| `name`       | `string`       | trimmed; blank is left out                                           |
| `ttlSeconds` | `number`       | whole seconds, 1 to 86 400; default 3 600                            |
| `now`        | `() => number` | milliseconds; default `Date.now` (tests)                             |

It throws an `Error` naming the option for input the API would refuse (an empty secret, a `sub` of 0 or
over 200 characters, a `ttlSeconds` over 24 hours or not a positive whole number, a bad e-mail, a token
over 2 048 characters), instead of letting the widget meet an `intake.errors.identity-invalid` later.

The secret lives in an environment variable such as `PULSARIX_IDENTITY_SECRET`, never in the page,
the repository or a public config. Tokens expire: sign a fresh one on each request that renders the
page (a loader, a session endpoint) and call `identify(newToken)` before the old one lapses; 1 hour is
the recommended life.

A React Router loader signs, the component hands the token to the widget, and sign-out clears it:

```tsx
// app/routes/app.tsx
// `Route` is React Router's generated type and `requireUser` is your own session helper.
// Import the signer in a route's loader only (or in a `*.server.ts` file the loader calls), never in
// code that runs in the browser.
import { signPulsarixIdentity } from "@softistx/pulsarix-widget/server";
import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request); // your own session
  return {
    pulsarixIdentity: signPulsarixIdentity({
      secret: process.env.PULSARIX_IDENTITY_SECRET as string,
      publicKey: process.env.PULSARIX_PROJECT_KEY as string,
      sub: user.id,
      email: user.email,
      name: user.name,
    }),
  };
}

export default function App() {
  const { pulsarixIdentity } = useLoaderData<typeof loader>();
  useEffect(() => {
    // The script tag's PulsarixWidget queues the call until the bundle has loaded.
    window.PulsarixWidget?.identify(pulsarixIdentity);
  }, [pulsarixIdentity]);
  return <Outlet />;
}

// at sign-out, in the browser, before the session ends:
//   window.PulsarixWidget?.identify(null);
```

In a strict-TypeScript host, the script tag's global is not typed: declare it once
(`declare global { interface Window { PulsarixWidget?: { identify(token: string | null): void } } }`)
or use the npm route.

With the npm route, call `widget.identify(token)` on the handle `mount()` returned. See
[docs/integration.md](docs/integration.md) for the whole integration, CSP and troubleshooting.

## Screenshots

A report can carry one optional screenshot, never taken without a click (and a per-report
choice). The one "Attachments" control of the form offers:

- **Capture this page** (under the one "Add" control): the browser's screen capture (`getDisplayMedia`). The widget hides itself
  (`visibility`, not unmount, so the form keeps its text) while the frame is grabbed, then shows
  itself again. Not offered on a phone, without the API, or under a Permissions-Policy that blocks
  `display-capture`.
- **Upload a file** (under "Add"): always offered, and the only choice where capture is unavailable or was
  refused. PNG, JPEG, WebP or PDF. An uploaded image opens in the same editor as a capture (a PDF is
  a plain attachment).
- **Mask the text on the page** (off by default; `data-mask-text="true"`, or `maskText: true` in `init` / `mount`, turns it on when the dialog opens): covers the
  page's text with opaque boxes before the picture is taken. It needs the current tab to be shared;
  otherwise the widget says it cannot and nothing is captured. Mark anything that must stay visible
  with `data-capture-unmask`.

A capture or an uploaded image opens straight in the editor (a separate chunk, fetched when first needed) with a pen, a highlighter,
an arrow, a box, text, a solid "Redact" box (redacted pixels are one opaque colour) and Crop, which trims the
picture before it is kept. Only the flattened
export (2560 px on its longest side at most) is kept when you save; Cancel in the editor keeps the
capture as it was taken. No media track stays live. The screenshot and the files share one list of removable thumbnails. Every image has an "Edit" button that reopens it (the
kept image, not the raw capture). Each capture records the page it was taken on (origin and path, never
the query or the fragment), shown under it ("Captured on ...") and in the editor. The report's
`pageUrl` is the first capture's page, and each capture's page is also sent as a `metadata` entry
(`capture-1-page`, `capture-2-page`, ... by position among the captures; those keys are reserved: a
host entry of that shape is dropped, and when the whole passes the metadata limits the host's entries
are dropped from the end first). A report is complete without
any of this. No `blob:` image source is needed in your CSP (the editor draws on canvases), and a
`Permissions-Policy` without `display-capture` turns the capture button off.

Events, on the element and through `on(name, cb)`: `pulsarix:ready` (asynchronous, in a microtask,
so a listener added right after `mount()` hears it; it fires even when the key is missing, then
`pulsarix:error` with `config` follows), `pulsarix:open`,
`pulsarix:close`, `pulsarix:submit` (`detail: { reportId, files }`, one `{ name, role, type, size,
uploaded }` per file sent with the report), `pulsarix:reply` (`detail: { requestId }`, the team
replied to one of the reporter's requests), `pulsarix:unread` (`detail: { count }`, the reporter's
unread replies changed), `pulsarix:erase` (`detail: { requests }`, the reporter erased their
data) and `pulsarix:error`
(`detail: { code }`, the API's `intake.errors.*` code, or `network`, `config`, `http-<status>`).

```ts
widget.on("pulsarix:submit", (event) => console.log(event.detail.reportId));
widget.on("pulsarix:error", (event) => console.warn(event.detail.code));
```

## Attached files

Besides the screenshot, a reporter can attach up to 3 files (PNG, JPEG, WebP or PDF, 5 MB each,
12 MB for the report, screenshot included) by dropping them on the dialog or with "Add" then "Upload a file". The
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

## Strict CSP and the requests thread

The requests thread's scroll area injects one `<style>` element into the shadow root. Under a strict
`style-src`, give your page a nonce: a `style` or `script` element carrying `nonce`, or
`<meta property="csp-nonce" content="...">`. The widget reads it and puts it on that element. The
form, the dialog and the screenshot editor need no nonce.

## Serving (script-tag integrators)

The pulsarix host serves `/widget/v1/loader.js` (short cache) and the hashed bundle it imports
(long cache). The bundle needs `Access-Control-Allow-Origin: *`. Your CSP needs `script-src` and
`connect-src` for the pulsarix host.
