# pulsarix-widget

The owner's rules for every repository are in `~/.claude/CLAUDE.md`. The conventions follow
operix-ui (`~/workspace/dev/operix/operix-ui/AGENTS.md`). This file states only the widget's
invariants and where it departs from the UI conventions.

- The loader stays at 5 KB gzipped or less (`scripts/check-size.ts`).
- Exactly one global, `PulsarixWidget` (the leak test, `bun run test:browser`).
- No `rem` lengths in the built CSS (`tests/build.test.ts`).
- No document-level styles: everything stays inside the shadow root.
- Requests use `credentials: "omit"`.
- The page URL is sent without its query or fragment (`location.origin + location.pathname`).
- The package is self-contained: everything `dist/` inlines (React, `@softistx/material`, ...)
  is a `devDependency`, so `dependencies` stays empty and the package itself has no
  runtime dependencies. The npm entry has `.d.ts` files (`tsconfig.build.json`, run by the build).
- The shipped declarations are only those reachable from `dist/types/index.d.ts` (`index`,
  `config`, `element`, `mount`), listed in `files`; they must import nothing but each other (no `react`,
  no `react-hook-form`, no generated CSS). If `index.d.ts` starts to reach another file, add it to
  `files` and keep the throwaway-tsconfig check (`skipLibCheck: false`, no react installed) clean.
- `@softistx/pulsarix-widget/server` (`src/server.ts`, built to `dist/server.js` and `dist/types/server.d.ts`, both in
  `files`) is the one server-only entry: it imports only `node:crypto` and nothing imports it, so the
  browser bundle and the loader stay unchanged (`tests/build.test.ts` checks it).
- Release (npmjs, public, CI only; no local publish): from an up-to-date `develop` worktree, bump
  `version` in `package.json`, merge that PR, then tag it: `git tag v<version> && git push origin v<version>`.
  `.github/workflows/publish.yml` (tags `v*` and `**@*`, a published release, or `workflow_dispatch`; concurrency
  group = commit sha; only a commit on `develop`) runs `bun run verify`, then `bun run release`
  (`scripts/publish.ts`, secret `NPM_TOKEN`), which skips a version already on npmjs. Check it
  afterwards: `npm view @softistx/pulsarix-widget version`. `publishConfig` is npmjs with restricted
  access (the package is private, softistx/plugins#233). npmjs only, through `publish.yml`:
  `@softistx/*` installs from registry.npmjs.org too, with the read-only token
  `NPM_SOFTISTX_READ_TOKEN` named by the `bunfig.toml` scope (CI passes `secrets.NPM_TOKEN`).
- `mount()` is a singleton while its element is attached.

## Conventions

An embeddable widget is not a BFF: it keeps the invariants above and takes the UI conventions
(`~/workspace/dev/operix/operix-ui/AGENTS.md`) wherever they cost no bytes. Where the code does not
follow yet, the rule is the target and names its slice (tracking issue #134).

- **UX (owner, 2026-11-22, #172)**: the launcher is an edge tab (owner, 2026-11-23, #179), a 44 px icon button
  docked flush to the viewport edge with a tooltip label, `launcher: { side, offset }` set by the host and
  movable by the reporter (drag, Alt+ArrowUp/Down, saved per host origin in `localStorage`; a drag never
  opens the dialog; breaking in 0.7: `position`, `offset` and `--pulsarix-launcher-*` are gone, see the README
  migration). The `launcher` values `auto|pill|icon` are still parsed and give the tab; an identified reporter's tab opens a
  menu (report, My requests with its unread badge), each item one view, never tabs; the report is one
  unsplit form (no tabs, no steps) with titled groups: a "Screenshot" / "Capture d'écran" section (its mask
  switch, the capture button and its pictures) and a separate "Pièces jointes" / "Attachments" section (a drop zone and the
  file list). A capture and an uploaded image both open
  straight in the editor (Cancel keeps the raw file), every image has an "Edit" button, and each capture
  stores the page it was taken on (`pageUrl`, shown as "Captured on ...", sent as the report's `pageUrl`
  for the first and as `capture-N-page` metadata for each). The editor is wrapped by
  `modules/screenshot/components/editor-host.tsx`: it is the seam where material's `ImageEditor` (and
  `ChatThread` / `ChatComposer` for the thread, material#5563) replace the in-house wiring. Test helper: `src/test-host.tsx` (a root file, so it may import `App`; tests only).
- **Layout** (alignment W5, #134): the entry files `index.ts`, `loader.ts`, `element.tsx` and
  `config.ts` stay at the root of `src/` (they are the shipped `.d.ts`), with `app.tsx` and
  `app-props.ts`, the composition root that mounts the modules. The rest is
  `src/core/{api,messages,shell,theme}` and `src/modules/<m>/{components,hooks,model}` (modules
  `report`, `requests`, `files`, `screenshot`), each module with an `api.ts` when it has operations of
  its own (`core/api/api.ts` holds `publicCall` and `IntakeError`). Imports go one way, enforced by
  `bun run check:deps` (`scripts/check-deps.ts`, part of `verify`): `core` imports only `core` and `config.ts`; a module
  imports itself, `core` and `config.ts`; the two features `report` and `requests` never import each
  other, and may use the leaf modules `files` (and, for `report`, `screenshot`), which import no module.
  Unit tests sit beside their source (`*.test.ts[x]`; `tests/` keeps only `setup.ts`, the build test
  and the loader's stub); browser tests stay in `scripts/`. Tailwind scans only `src/` (no tests, no
  generated files).
- **GraphQL** (alignment W3/W4, #134): every call is a persisted operation sent by id on
  `/public/graphql`, the ids typed as the `PersistedId` union. Types come from type-only codegen
  (`typescript` and `typescript-operations`, no client preset) against the public schema the API
  prints: it adds no byte to the bundle. `schema/` holds the committed copies of the API's
  `schema.public.graphql` and `operations/public/*.graphql` (the latter flat in `schema/operations/`): `bun run schema:sync` refreshes them
  by reading `PULSARIX_API_REF` (default `origin/develop`) in the API checkout `PULSARIX_API` (default `../pulsarix-api` beside the
  main checkout), whatever branch that checkout is on. `schema:check` fails when they differ and
  skips with a message when the checkout is absent. `bun run generate` (`scripts/generate.ts`)
  writes `src/core/api/public.ts` (committed, never edited): the operations' variable and result
  types, the inputs and enums they use (`typescript-operations` alone, since v7 emits them) and
  the `PersistedId` union of the operation ids and the `PersistedOperations` map (variables and result by
  id) that types `publicCall`; each operation's root field must be named after its id. `generate:check` fails when it is stale. `verify`
  runs both checks.
- **i18n**: recorded departure from the UI's catalogue and `check:i18n`. Messages are typed TS
  catalogues (`Messages`): there is no ICU runtime to ship, and the compiler enforces parity between
  languages.
- **Errors** (alignment W1, #134): the API's catalogue words `intake.errors.*`, and the widget shows
  the API's message. Waits come from `extensions.minutes`; nothing is parsed from a message. Local words
  exist only for `network`, `config` (a non-API refusal included), unreachable, a lapsed live-stream
  session (made client-side) and `unknown`.
- **Theme**: `lavande` by default. The host accent is the documented exception: an embed matches its
  host page: it inherits the host's `@softistx/material` theme (tokens read from `<html>`, validated,
  set inline on the widget's root, followed live; `inheritTheme: false` opts out; `src/core/theme/inherit.ts`,
  docs/integration.md), with `lavande` as the fallback for every token the host lacks, and the host's explicit
  accent still wins over the inherited `--primary`.
- **Checks** (alignment W2/W3/W5, #134): `verify` grows `check:deps` (the layout's import direction),
  `generate:check` and `schema:check` (generated types and the schema copy in sync), and a gzipped
  budget for the main bundle beside the loader cap in `scripts/check-size.ts`.

## Develop

```sh
bun run verify        # lint, schema and type checks, build, typecheck, unit tests, import direction, bundle sizes (loader at most 5 KB gzipped, main widget bundle at most 314 KiB gzipped)
bun run test:browser  # the host-fixture leak test in Chromium (local only, not in CI)
bun run capture <dir> # 360 and 1440 px, light and dark, widget open
```

- The npm tarball ships `dist/index.js` and `dist/types` only (`files`). `loader.js`, the hashed
  bundle and `manifest.json` are the hosted artifacts the UI serves, not part of the npm package.
- `sideEffects: true`: importing the entry registers `<pulsarix-widget>`.
- **The icon sheet** (`dist/icons/duotone.svg`) is cut at build time from a licensed Font Awesome Pro
  file read from `ICON_SPRITES_DIR`. It is never committed and never in the npm package; it ships only
  as a hosted artifact beside the loader (the deploy builds with `REQUIRE_ICONS=1`, which makes a
  missing source an error instead of a warning). The widget reads it from `<apiBase>/widget/v1/icons/`.
