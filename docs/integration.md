# Integrating the pulsarix widget in a host app

This guide takes a host app (the site or product that embeds the widget) from nothing to reports
and "My requests" working. Reference for every option and event: the [README](../README.md).

1. [Get a project and a widget key](#1-get-a-project-and-a-widget-key)
2. [Add the widget](#2-add-the-widget)
3. [Identify your signed-in users](#3-identify-your-signed-in-users)
   - [Signing from a root loader with an optional viewer](#signing-from-a-root-loader-with-an-optional-viewer)
4. [Content Security Policy](#4-content-security-policy)
5. [Options and metadata](#5-options-and-metadata)
6. [Events](#6-events)
7. [Local development origins](#7-local-development-origins)
8. [Troubleshooting](#8-troubleshooting)
9. [Inheriting the host app's theme](#9-inheriting-the-host-apps-theme)
10. [Changing theme, locale and metadata at run time](#10-changing-theme-locale-and-metadata-at-run-time)
11. [The launcher: look, position and visibility](#11-the-launcher-look-position-and-visibility)
    - [Sticky bottom bars: `holdLauncher()`](#sticky-bottom-bars-holdlauncher)

## 1. Get a project and a widget key

In pulsarix, create (or open) the project that will receive the reports, then add a widget key to it.
A key has:

- a **public key**, `pk_live_…`: it goes in your page and is not secret;
- **allowedOrigins**: the exact origins that may send reports with that key, one per line, each
  `https://host[:port]` (plain `http://` only for `localhost`, `127.0.0.1` and `[::1]`). No path, query,
  fragment, credentials or wildcard; `https://app.example.com`, never `https://app.example.com/page`
  or `https://*.example.com`. A request from any other origin, or with no `Origin`, is refused;
- an optional **identity secret** for signed-in users (section 3): in the key's "Signed-in users" card,
  press "Generate secret". It is **shown once**: copy it into your server's environment right away
  (for example `PULSARIX_IDENTITY_SECRET`), with the public key beside it as `PULSARIX_PROJECT_KEY`. It cannot be read again; "Regenerate" makes a new one and
  the old one stops working at once.

The key also has a switch (disabled keys refuse everything) and a "Screenshots and files" switch.

## 2. Add the widget

### Script tag

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx"></script>
```

The loader is tiny (at most 5 KB gzipped) and loads the widget bundle on first use. The widget's API
origin is the host that served the loader; override it with `data-api-base`.

### npm `mount()`

For an app that installs the package (see the README's "Install" for the read token):

```ts
import { mount } from "@softistx/pulsarix-widget";

const widget = mount({
  projectKey: "pk_live_xxx",
  apiBase: "https://<pulsarix-host>", // required on the npm route
  locale: "fr",
});
```

The module is browser-only: in an SSR framework import it on the client, inside an effect:

```tsx
useEffect(() => {
  let widget: { destroy(): void } | undefined;
  import("@softistx/pulsarix-widget").then(({ mount }) => {
    widget = mount({ projectKey, apiBase });
  });
  return () => widget?.destroy();
}, [projectKey, apiBase]);
```

One widget per page: use the script tag or `mount()`, not both.

## 3. Identify your signed-in users

Without an identity the widget is the anonymous report form. With one, reports are filed under the
reporter, who also gets a "My requests" view (threads, replies, unread counts, "Delete my data").

Your server signs a short-lived token for the signed-in user with the key's identity secret; the browser
only carries the token. The helper does the signing:

```ts
// server only
import { signPulsarixIdentity } from "@softistx/pulsarix-widget/server";

export function pulsarixTokenFor(user: {
  id: string;
  email: string;
  name: string;
}) {
  return signPulsarixIdentity({
    secret: process.env.PULSARIX_IDENTITY_SECRET as string,
    publicKey: process.env.PULSARIX_PROJECT_KEY as string, // pk_live_xxx
    sub: user.id,
    email: user.email,
    name: user.name,
    ttlSeconds: 3600, // 1 hour (the default); 24 hours at most
  });
}
```

Import the signer only in server code (a loader, or a `*.server.ts` file), never in the browser. Then hand
the token to the widget, and clear it at sign-out. In a strict-TypeScript host the script tag's global is
not typed: declare it once with
`declare global { interface Window { PulsarixWidget?: { identify(token: string | null): void; holdLauncher(): () => void } } }`,
or use the npm route's typed handle:

```ts
// browser, after sign-in or on each page load (script tag)
window.PulsarixWidget.identify(token);

// at sign-out
window.PulsarixWidget.identify(null);

// npm route: the handle mount() returned
widget.identify(token);
```

or give it at the start: `data-identity="<token>"` on the script tag, or `identity` in `init` / `mount`.

Rules of the token (the helper enforces them and throws otherwise):

| Part        | Rule                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| `sub`       | 1 to 200 characters, your stable user id; pulsarix keeps only a digest per key |
| `email`     | optional, a valid address, 254 characters at most                              |
| `name`      | optional, trimmed, 100 characters at most                                      |
| `aud`       | the key's public key (the helper's `publicKey`)                                |
| `iat`/`exp` | integer seconds; a life of 24 hours at most, 1 hour recommended                |
| whole token | 2 048 characters at most                                                       |

The token is `<payload>.<signature>`, both base64url without padding; the signature is the
HMAC-SHA256 of the payload text, keyed with the secret **as the raw string** (not base64url-decoded).
The API allows 5 minutes of clock skew between your server and itself.

**Re-sign before expiry.** A token is not renewed by the widget. Sign a new one on each request that
renders a page, or from a small endpoint your page calls every half life, and call `identify(newToken)`.
A tab that stays open longer than the token lives gets `pulsarix:error` with
`intake.errors.identity-expired` (or `identity-invalid`) until you do.

Keep the secret in an environment variable on the server. It must never reach a page, a public
environment variable, a repository or a log.

### React Router (loader)

```tsx
import { signPulsarixIdentity } from "@softistx/pulsarix-widget/server";
import { Outlet, useLoaderData } from "react-router";
import { useEffect } from "react";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
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

export default function Layout() {
  const { pulsarixIdentity } = useLoaderData<typeof loader>();
  useEffect(() => {
    window.PulsarixWidget?.identify(pulsarixIdentity);
  }, [pulsarixIdentity]);
  return <Outlet />;
}
```

### Signing from a root loader with an optional viewer

The loader above sits under a layout that already requires a signed-in user. When the viewer is
optional (a public site with an account), sign from the root loader instead and give `identify()`
`null` for a visitor. Drive it from the loader data, so it also covers sign-out: the loader reruns,
the token becomes `null` and the widget drops "My requests", with no sign-out hook in your app.

```tsx
// app/root.tsx
import { signPulsarixIdentity } from "@softistx/pulsarix-widget/server";
import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request); // your own session; `null` for a visitor
  return {
    pulsarixIdentity: user
      ? signPulsarixIdentity({
          secret: process.env.PULSARIX_IDENTITY_SECRET as string,
          publicKey: process.env.PULSARIX_PROJECT_KEY as string,
          sub: user.id,
          email: user.email,
          name: user.name,
        })
      : null,
  };
}

export default function Root() {
  const { pulsarixIdentity } = useLoaderData<typeof loader>();
  useEffect(() => {
    window.PulsarixWidget?.identify(pulsarixIdentity);
  }, [pulsarixIdentity]);
  return <Outlet />;
}
```

The cost: a root loader runs on every document request and on every revalidation, so a signed-in
viewer is signed once per request (an HMAC, microseconds) and the token in the page changes each
time, which makes the response differ per user: do not cache it in a shared cache. Keep the life
short (the default hour) and `identify()` again with the fresh token on each run, as the effect does.
To sign less often, give the loader `shouldRevalidate` so it reruns only after a sign-in or sign-out,
and re-sign before expiry (see above). A visitor costs nothing: no signature, and `identify(null)`.

A token given with `identify()` stays in the widget's memory; one in `data-identity` is an attribute of
the element and visible in the DOM, so prefer `identify()`.

## 4. Content Security Policy

Allow the pulsarix host in `script-src` (the loader and the bundle) and in `connect-src` (the API calls,
the file uploads and the live stream of an open thread; the same origin for all three):

```
Content-Security-Policy:
  script-src 'self' 'nonce-<per-request>' https://<pulsarix-host>;
  connect-src 'self' https://<pulsarix-host>;
```

- Nothing else is needed for images or capture: thumbnails and the screenshot editor draw on canvases,
  so there is no `img-src blob:`. Screen capture needs `display-capture` in your `Permissions-Policy`
  (uploading an image works without it).
- Lazy chunks come from the same pulsarix host, so no extra `script-src` entry: the screenshot editor
  (fetched on the first capture) and the markdown renderer of the team's replies (`chat-markdown-*.js`,
  about 740 KB, 221 KB gzipped, fetched when a thread opens; plain text shows until it arrives). Serve
  every file of the widget's folder beside the entry, with the bundle's cache headers.
- The widget's styles are adopted into its shadow root: no `style-src 'unsafe-inline'`. The requests
  thread injects one `<style>` element; under a strict `style-src` give your page a nonce, which the
  widget reads from a `nonce` attribute on a `style` or `script` element or from this tag:

```html
<meta property="csp-nonce" content="<per-request nonce>">
```

## 5. Options and metadata

Script-tag attributes and `init` / `mount` options (all optional except the key):

| Attribute / option                         | Effect                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `data-project-key` / `projectKey`          | the public key (required)                                         |
| `data-api-base` / `apiBase`                | the pulsarix origin; required on the npm route                    |
| `data-locale` / `locale`                   | `en` (default) or `fr`                                            |
| `data-theme` / `theme`                     | `light`, `dark` or `auto` (default)                               |
| `data-launcher-side` / `launcher.side`     | `right` (default) or `left` (section 11)                          |
| `data-launcher-offset` / `launcher.offset` | a fraction from 0 (top) to 1 (bottom), `0.5` default (section 11) |
| `data-accent-color` / `accentColor`        | a hex seed for the theme                                          |
| `data-launcher` / `launcher`               | `false` for none; any other value gives the edge tab (section 11) |
| `data-attachments="false"`                 | no screenshot and no file controls                                |
| `data-mask-text="true"`                    | "Mask the text on the page" starts on                             |
| `data-privacy-url` / `privacyUrl`          | an http(s) link to your privacy page                              |
| `data-prefill-email`, `data-prefill-title` | starting values of the form                                       |
| `data-identity` / `identity`               | the signed token (section 3)                                      |
| `data-metadata` / `metadata`               | a JSON object of strings stored with each report                  |

`metadata` carries facts about the session that help triage: at most 20 entries, keys of 64 characters,
values of 512, 2 KB in all; the rest is dropped. The keys `capture-N-page` are reserved: the widget
writes one per screenshot (the page it was taken on, origin and path), drops a host entry of that shape,
and drops the host's last entries first when the whole would pass these limits.

```html
<script src="https://<pulsarix-host>/widget/v1/loader.js" async
        data-project-key="pk_live_xxx"
        data-locale="fr"
        data-metadata='{"plan":"pro","build":"2026.11.3"}'></script>
```

```ts
PulsarixWidget.init({
  projectKey: "pk_live_xxx",
  metadata: { plan: "pro", build: "2026.11.3" },
  prefill: { email: user.email },
});
```

The page address is sent without its query or fragment.

## 6. Events

Heard on the element and with `on(name, callback)`, which returns the function that unsubscribes:

| Event             | `detail`              | When                                                                           |
| ----------------- | --------------------- | ------------------------------------------------------------------------------ |
| `pulsarix:ready`  | none                  | the widget is mounted (asynchronous)                                           |
| `pulsarix:open`   | none                  | the dialog opened                                                              |
| `pulsarix:close`  | none                  | the dialog closed                                                              |
| `pulsarix:submit` | `{ reportId, files }` | a report was sent                                                              |
| `pulsarix:reply`  | `{ requestId }`       | the team replied to one of the reporter's requests                             |
| `pulsarix:unread` | `{ count }`           | the reporter's unread replies changed                                          |
| `pulsarix:erase`  | `{ requests }`        | the reporter erased their data                                                 |
| `pulsarix:error`  | `{ code }`            | a failure; the API's `intake.errors.*`, `network`, `config` or `http-<status>` |

```ts
const off = PulsarixWidget.on("pulsarix:submit", (e) =>
  analytics.track("report", e.detail.reportId),
);
PulsarixWidget.on("pulsarix:error", (e) =>
  console.warn("pulsarix", e.detail.code),
);
```

## 7. Local development origins

A key only accepts the origins on its allow-list, so list the one your dev server uses, with its port:

```
https://app.example.com
http://localhost:5173
http://127.0.0.1:5173
```

Plain `http` is accepted for `localhost`, `127.0.0.1` and `[::1]` only; any other dev host (a LAN
address, `*.local`) needs `https`. Use a separate key for development and production so a dev origin
never sits on the production key.

## 8. Troubleshooting

| Symptom or code                                                                                                                                                              | Cause                                                                                                                                                                                                                                            | Fix                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intake.errors.unknown-key` (404), `http-404`                                                                                                                                | the public key is mistyped, revoked, or not a key                                                                                                                                                                                                | copy the key again from the project                                                                                                                                                             |
| `intake.errors.origin-not-allowed` (403)                                                                                                                                     | the page's origin is not on the key's `allowedOrigins`, or the request has no `Origin`                                                                                                                                                           | add the exact origin (scheme, host, port; no path); see section 7                                                                                                                               |
| `network` with no console message from the API                                                                                                                               | the browser hid a CORS refusal: the origin is not allowed, or the key is unknown                                                                                                                                                                 | check the browser's network tab, then `allowedOrigins`; the origin must match exactly, `www.` and ports included                                                                                |
| `intake.errors.key-disabled` (403)                                                                                                                                           | the key's switch is off                                                                                                                                                                                                                          | switch it on in the project                                                                                                                                                                     |
| `intake.errors.identity-invalid` (401)                                                                                                                                       | the token is forged, signed with another secret, for another key (`aud`), not yet valid (clock), older than its `exp`, longer than 24 hours, over 2 048 characters, or the key has no identity secret. The API gives one answer for all of these | sign with `signPulsarixIdentity` using the key's current secret and its own public key; check the server clock; generate a secret if the key has none; regenerate invalidates every older token |
| `intake.errors.identity-expired`                                                                                                                                             | an open live thread outlived its token                                                                                                                                                                                                           | sign a new token and call `identify(newToken)`; re-sign every half life                                                                                                                         |
| `intake.errors.too-many-requests` (429)                                                                                                                                      | a rate limit: reports per address, per key, per e-mail, per identified reporter, or reads                                                                                                                                                        | wait the time the message gives (`retryAfter`); do not retry in a loop                                                                                                                          |
| `intake.errors.too-fast` (400)                                                                                                                                               | the form was sent less than 3 seconds after opening                                                                                                                                                                                              | the widget waits it out; only a script that posts the form hits it                                                                                                                              |
| `intake.errors.key-not-found` (404), `intake.errors.not-found` (404)                                                                                                         | the key or the request no longer exists                                                                                                                                                                                                          | check the key; refresh the list                                                                                                                                                                 |
| `intake.errors.file-unsupported-type` (415), `file-undecodable` (422), `file-too-large` (413), `file-too-many-pixels` (422), `too-many-files` (400), `files-too-large` (413) | an attached file the API refuses (PNG, JPEG, WebP or PDF; 5 MB each, 12 MB and 3 files per report, 25 megapixels)                                                                                                                                | the widget checks these first and shows the reason; attach a smaller or supported file                                                                                                          |
| `intake.errors.ticket-invalid`, `ticket-expired`, `ticket-used`, `upload-mismatch`, `quarantine-full`                                                                        | an upload ticket is damaged, older than 15 minutes, already used, or the organisation's quarantine is full                                                                                                                                       | send the report again; if it persists, tell the project's owners                                                                                                                                |
| `intake.errors.request-declined` (409), `reopen-expired` (409)                                                                                                               | a declined request is read-only; a request resolved over 30 days ago cannot be reopened                                                                                                                                                          | open a new request                                                                                                                                                                              |
| `intake.errors.attachments-disabled` (403)                                                                                                                                   | the key's "Screenshots and files" switch is off                                                                                                                                                                                                  | switch it on, or set `data-attachments="false"`                                                                                                                                                 |
| `config`                                                                                                                                                                     | no project key, or no `apiBase` on the npm route                                                                                                                                                                                                 | give both                                                                                                                                                                                       |
| `intake.errors.unavailable` (503)                                                                                                                                            | the service cannot check its limits                                                                                                                                                                                                              | retry shortly                                                                                                                                                                                   |
| `signPulsarixIdentity: ... must be ...`                                                                                                                                      | an option the API would refuse                                                                                                                                                                                                                   | fix the named option; the message says which                                                                                                                                                    |
| Blocked by CSP in the console                                                                                                                                                | the pulsarix host is missing from `script-src` or `connect-src`, or a strict `style-src` has no nonce                                                                                                                                            | section 4                                                                                                                                                                                       |
| `identify()` seems ignored                                                                                                                                                   | the token is malformed (anything that is not `<payload>.<signature>` is dropped)                                                                                                                                                                 | pass the string `signPulsarixIdentity` returned, unchanged                                                                                                                                      |

## 9. Inheriting the host app's theme

When the host app is built on `@softistx/material`, the widget wears the host's theme (its
colours, radius and light or dark mode) instead of its own `lavande` one, and follows the host
when the user changes theme. Nothing to configure: `inheritTheme` is `true` by default.

```ts
mount({ projectKey: "pk_live_xxx", apiBase: "https://pulsarix.example.com" });
// the host's theme picker, dark mode and primary now apply to the dialog

mount({ projectKey: "pk_live_xxx", inheritTheme: false }); // the widget's own look, as before
```

Script tag: `data-inherit-theme="false"`. Element attribute: `inherit-theme="false"`.

**`theme` at mount does not turn host inheritance off.** On a host that provides tokens, the widget
keeps wearing the host's colours and its light or dark mode; the `theme` option (`light`, `dark`,
`auto`) only decides the mode when the host does not say. To keep the widget's own look, pass
`inheritTheme: false`; to force the mode at run time, call `setTheme("light" | "dark")`.

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
  re-read the tokens (`data-theme` and `data-mode` only trigger a re-read; they never decide
  dark or light). It stops when the widget is removed (`destroy()`).

### Limits

- The tokens are read from `<html>`. A host that scopes its theme to a wrapper element (not
  `<html>`) is not read: the widget keeps its own look.
- Custom properties set at run time through a host's stylesheet swap (a new `<link>`) without an
  attribute change on `<html>` are picked up at the next attribute change or scheme change.
- Pairing: the inherited colours are the host's own, so the widget is as readable as the host.
  Mixing a few inherited tokens with the widget's own for the rest (a partial host theme) can
  lower contrast; set `inheritTheme: false` when the host only defines part of the palette.

## 10. Changing theme, locale and metadata at run time

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

- `"light"` and `"dark"` are applied exactly. `"auto"` follows the operating system's
  `prefers-color-scheme`, never the host page's class or attribute. A host with its own mode switch passes the
  resolved `"light"` or `"dark"` to `setTheme` on each change.
- `setTheme` is independent of `inheritTheme` (section 9). With `inheritTheme`, the widget follows the host's
  mode when the host provides tokens, and the `theme` given at mount (or written later as the `theme`
  attribute) decides only when it does not. `setTheme("light")` or `setTheme("dark")` wins over the
  host's mode until the `theme` attribute is written again (that gives the mode back to the host);
  `setTheme("auto")` gives it back at once. An inherited token still wins for its colour value.
- `setTheme` only sets the widget's own mode. The accent (`accentColor`) is a mount option and does not change.
- `setMetadata` replaces; it does not merge. The limits are those of `metadata` at mount (20 entries, keys of
  64 characters, values of 512, 2 KB in all). A report already sent is not changed.
- `setLocale` changes the widget's own strings at once. The built-in labels of `@softistx/material` (the close
  button, the file list, ...) are read once by its i18n context, so they change when the form is next idle:
  - On an idle form, the typed fields, the chosen type and impact are kept; files and a
    screenshot already attached are dropped.
  - While a report is being sent, on the confirmation screen, or in the "My requests" view, nothing is rebuilt:
    those built-in labels switch when the reporter returns to the form (or the dialog closes), and no
    attachment is lost.
  - `setTheme` and `setMetadata` drop nothing.
- An unsupported theme or locale is ignored.
- Calls before the script-tag bundle has loaded are queued, replayed in order; a repeated call to the same
  setter replaces the earlier one, so only the last `setTheme`, `setLocale` and `setMetadata` run.

## 11. The launcher: look, position and visibility

The edge tab that opens the dialog. Two options shape it; each has script-tag attributes and a `mount()` option.

### Look: `launcher`

The launcher is an icon button, 44 x 44 px at every width, docked flush to the viewport edge and
rounded on the content side only. It wears the pulsarix mark and the unread badge. At rest it peeks 6 px
less; it slides fully in on hover, focus and while dragged. Its label is a tooltip only
("Report a problem", with "Drag to move" on a second line): shown on hover or keyboard focus after a short
delay, hidden while dragging and on screens with no hover. The `launcher` option no longer changes its
look: `"auto"`, `"pill"` and `"icon"` are still read so existing embeds keep working, and `false` removes it
(open the dialog with `open()`).

Without a token the tab opens the report form directly. With a token it opens a small menu beside it
with two items, "Report a problem" and "My requests" (with its unread badge); each opens one
view, never tabs. The tab keeps the localized label as its accessible name and carries the unread
count in it ("Report a problem, 3 unread requests"). It has `aria-expanded`, `aria-controls` and
`aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"`, a visible focus ring, and respects `prefers-reduced-motion`.

### Position: `launcher.side` and `launcher.offset`

You choose where the tab starts: the edge (`"right"` default, or `"left"`) and a vertical fraction
`offset` from `0` (top) to `1` (bottom), `0.5` by default. A value outside 0..1 is clamped, junk is the
default.

```ts
mount({ projectKey: "pk_live_xxx", launcher: { side: "left", offset: 0.3 } });
```

```html
<script ... data-launcher-side="left" data-launcher-offset="0.3"></script>
```

The reporter can then move it along the edge, by dragging it (pointer or touch) or with
Alt+ArrowUp / Alt+ArrowDown (each move is announced in a live region). A drag never opens the dialog; only a
click, Enter or Space does. The tab keeps a 16 px gap from the top and the bottom of the viewport, also
when the window is resized. The position is saved in `localStorage` under a key of your page's origin
(inside a try/catch: with storage blocked, it lasts until the page closes) and wins over your starting
point from then on.

### Migrating from 0.6 (breaking)

`position`, `data-position`, `offset`, `data-offset-bottom`, `data-offset-side` and the custom properties
`--pulsarix-launcher-bottom` / `--pulsarix-launcher-side` are removed. Use `launcher.side` and
`launcher.offset` (a fraction of the height, no longer pixels or CSS lengths). The tab is flush to the
edge, so there is no side distance. A host that reserved room for the round button can drop that
reserve. To clear a sticky bar, use `holdLauncher()` (below). The `Position` and `LauncherOffset`
types are replaced by `LauncherSide` and `LauncherPlacement`.

### Visibility: `setLauncherVisible(visible)`

Hides or shows the launcher only, for a screen where the button is in the way:

```ts
const widget = mount({ projectKey: "pk_live_xxx" });
widget.setLauncherVisible(false); // on the checkout step
widget.setLauncherVisible(true);
```

An open dialog is never hidden or closed by it, and `open()` still works while the launcher is hidden.
With the script tag: `window.PulsarixWidget.setLauncherVisible(false)`. `launcher: false` still
removes the launcher for good.

### Sticky bottom bars: `holdLauncher()`

A host's own sticky bottom bar (a checkout bar, a cookie banner, an editor toolbar) can sit under the
launcher. `holdLauncher()` hides the launcher while the bar is on screen and returns a function that
gives it back. It is ref-counted, so two bars at once keep it hidden until both are released, and the
returned function is safe to call more than once.

```tsx
import { useEffect } from "react";

function StickyCheckoutBar() {
  useEffect(() => {
    // The script tag's global queues the call until the bundle has loaded.
    const release = window.PulsarixWidget?.holdLauncher();
    return () => release?.();
  }, []);
  return <div className="sticky bottom-0">…</div>;
}
```

With the npm route, `const release = widget.holdLauncher()`. It combines with `setLauncherVisible`: the
launcher shows only when `setLauncherVisible` is not `false` and no hold is open. Like it, a hold never
closes or hides an open dialog, and `launcher: false` still removes the launcher for good.
