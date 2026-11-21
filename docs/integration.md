# Integrating the pulsarix widget in a host app

This guide takes a host app (the site or product that embeds the widget) from nothing to reports
and "My requests" working. Reference for every option and event: the [README](../README.md).

1. [Get a project and a widget key](#1-get-a-project-and-a-widget-key)
2. [Add the widget](#2-add-the-widget)
3. [Identify your signed-in users](#3-identify-your-signed-in-users)
4. [Content Security Policy](#4-content-security-policy)
5. [Options and metadata](#5-options-and-metadata)
6. [Events](#6-events)
7. [Local development origins](#7-local-development-origins)
8. [Troubleshooting](#8-troubleshooting)

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
  (for example `PULSARIX_IDENTITY_SECRET`). It cannot be read again; "Regenerate" makes a new one and
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
reporter, who also gets a "My requests" tab (threads, replies, unread counts, "Delete my data").

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
    publicKey: process.env.PULSARIX_PUBLIC_KEY as string, // pk_live_xxx
    sub: user.id,
    email: user.email,
    name: user.name,
    ttlSeconds: 3600, // 1 hour (the default); 24 hours at most
  });
}
```

Then hand the token to the widget, and clear it at sign-out:

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
      publicKey: process.env.PULSARIX_PUBLIC_KEY as string,
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
- The widget's styles are adopted into its shadow root: no `style-src 'unsafe-inline'`. The requests
  thread injects one `<style>` element; under a strict `style-src` give your page a nonce, which the
  widget reads from a `nonce` attribute on a `style` or `script` element or from this tag:

```html
<meta property="csp-nonce" content="<per-request nonce>">
```

## 5. Options and metadata

Script-tag attributes and `init` / `mount` options (all optional except the key):

| Attribute / option                         | Effect                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| `data-project-key` / `projectKey`          | the public key (required)                             |
| `data-api-base` / `apiBase`                | the pulsarix origin; required on the npm route        |
| `data-locale` / `locale`                   | `en` (default) or `fr`                                |
| `data-theme` / `theme`                     | `light`, `dark` or `auto` (default)                   |
| `data-position` / `position`               | `bottom-right` (default) or `bottom-left`             |
| `data-accent-color` / `accentColor`        | a hex seed for the theme                              |
| `data-launcher="false"` / `launcher`       | no floating button; open with `PulsarixWidget.open()` |
| `data-attachments="false"`                 | no screenshot and no file controls                    |
| `data-mask-text="true"`                    | "Mask the text on the page" starts on                 |
| `data-privacy-url` / `privacyUrl`          | an http(s) link to your privacy page                  |
| `data-prefill-email`, `data-prefill-title` | starting values of the form                           |
| `data-identity` / `identity`               | the signed token (section 3)                          |
| `data-metadata` / `metadata`               | a JSON object of strings stored with each report      |

`metadata` carries facts about the session that help triage: at most 20 entries, keys of 64 characters,
values of 512, 2 KB in all; the rest is dropped.

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

| Symptom or code                                | Cause                                                                                                                                                                                                                                            | Fix                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intake.errors.unknown-key` (404), `http-404`  | the public key is mistyped, revoked, or not a key                                                                                                                                                                                                | copy the key again from the project                                                                                                                                                             |
| `intake.errors.origin-not-allowed` (403)       | the page's origin is not on the key's `allowedOrigins`, or the request has no `Origin`                                                                                                                                                           | add the exact origin (scheme, host, port; no path); see section 7                                                                                                                               |
| `network` with no console message from the API | the browser hid a CORS refusal: the origin is not allowed, or the key is unknown                                                                                                                                                                 | check the browser's network tab, then `allowedOrigins`; the origin must match exactly, `www.` and ports included                                                                                |
| `intake.errors.key-disabled` (403)             | the key's switch is off                                                                                                                                                                                                                          | switch it on in the project                                                                                                                                                                     |
| `intake.errors.identity-invalid` (401)         | the token is forged, signed with another secret, for another key (`aud`), not yet valid (clock), older than its `exp`, longer than 24 hours, over 2 048 characters, or the key has no identity secret. The API gives one answer for all of these | sign with `signPulsarixIdentity` using the key's current secret and its own public key; check the server clock; generate a secret if the key has none; regenerate invalidates every older token |
| `intake.errors.identity-expired`               | an open live thread outlived its token                                                                                                                                                                                                           | sign a new token and call `identify(newToken)`; re-sign every half life                                                                                                                         |
| `intake.errors.too-many-requests` (429)        | a rate limit: reports per address, per key, per e-mail, per identified reporter, or reads                                                                                                                                                        | wait the time the message gives (`retryAfter`); do not retry in a loop                                                                                                                          |
| `intake.errors.too-fast` (400)                 | the form was sent less than 3 seconds after opening                                                                                                                                                                                              | the widget waits it out; only a script that posts the form hits it                                                                                                                              |
| `intake.errors.attachments-disabled` (403)     | the key's "Screenshots and files" switch is off                                                                                                                                                                                                  | switch it on, or set `data-attachments="false"`                                                                                                                                                 |
| `config`                                       | no project key, or no `apiBase` on the npm route                                                                                                                                                                                                 | give both                                                                                                                                                                                       |
| `intake.errors.unavailable` (503)              | the service cannot check its limits                                                                                                                                                                                                              | retry shortly                                                                                                                                                                                   |
| `signPulsarixIdentity: ... must be ...`        | an option the API would refuse                                                                                                                                                                                                                   | fix the named option; the message says which                                                                                                                                                    |
| Blocked by CSP in the console                  | the pulsarix host is missing from `script-src` or `connect-src`, or a strict `style-src` has no nonce                                                                                                                                            | section 4                                                                                                                                                                                       |
| `identify()` seems ignored                     | the token is malformed (anything that is not `<payload>.<signature>` is dropped)                                                                                                                                                                 | pass the string `signPulsarixIdentity` returned, unchanged                                                                                                                                      |
