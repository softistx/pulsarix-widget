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
  `config`, `element`), listed in `files`; they must import nothing but each other (no `react`,
  no `react-hook-form`, no generated CSS). If `index.d.ts` starts to reach another file, add it to
  `files` and keep the throwaway-tsconfig check (`skipLibCheck: false`, no react installed) clean.
- Release (npmjs, public, CI only; no local publish): from an up-to-date `develop` worktree, bump
  `version` in `package.json`, merge that PR, then tag it: `git tag v<version> && git push origin v<version>`.
  `.github/workflows/publish.yml` (tags `v*` and `**@*`, a published release, or `workflow_dispatch`; concurrency
  group = commit sha; only a commit on `develop`) runs `bun run verify`, then `bun run release`
  (`scripts/publish.ts`, secret `NPM_TOKEN`), which skips a version already on npmjs. Check it
  afterwards: `npm view @softistx/pulsarix-widget version`. `publishConfig` is npmjs with public
  access. npmjs only, through `publish.yml`: `@softistx/*` installs from registry.npmjs.org
  too, with no scope override in `bunfig.toml`.
- `mount()` is a singleton while its element is attached.

## Conventions

An embeddable widget is not a BFF: it keeps the invariants above and takes the UI conventions
(`~/workspace/dev/operix/operix-ui/AGENTS.md`) wherever they cost no bytes. Where the code does not
follow yet, the rule is the target and names its slice (tracking issue #134).

- **Layout** (alignment W5, #134): the entry files `index.ts`, `loader.ts` and `element.tsx` stay at
  the root of `src/` (they are the shipped `.d.ts`). The rest is `src/core/{api,shell,theme}` and
  `src/modules/<m>/{components,hooks,model}` (modules `report`, `requests`, `files`, `screenshot`), each module with an `api.ts` for its operations. Imports
  go one way: modules use `core`, never the reverse or each other. Unit tests sit beside their
  source; browser tests stay in `scripts/`.
- **GraphQL** (alignment W3/W4, #134): every call is a persisted operation sent by id on
  `/public/graphql`, the ids typed as the `PersistedId` union. Types come from type-only codegen
  (`typescript` and `typescript-operations`, no client preset) against the public schema the API
  prints: it adds no byte to the bundle. `schema/` holds the committed copies of the API's
  `schema.public.graphql` and `operations/public/*.graphql` (the latter flat in `schema/operations/`): `bun run schema:sync` refreshes them
  by reading `PULSARIX_API_REF` (default `origin/feat/align-conventions`, `origin/develop` once the
  API's alignment landed) in the API checkout `PULSARIX_API` (default `../pulsarix-api` beside the
  main checkout), whatever branch that checkout is on. `schema:check` fails when they differ and
  skips with a message when the checkout is absent. `bun run generate` (`scripts/generate.ts`)
  writes `src/graphql/public.ts` (committed, never edited): the operations' variable and result
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
  host page, so the host may set its accent instead of the app's `--primary`.
- **Checks** (alignment W2/W3/W5, #134): `verify` grows `check:deps` (the layout's import direction),
  `generate:check` and `schema:check` (generated types and the schema copy in sync), and a gzipped
  budget for the main bundle beside the loader cap in `scripts/check-size.ts`.

## Develop

```sh
bun run verify        # lint, build, typecheck, unit tests, bundle sizes (loader at most 5 KB gzipped, main widget bundle at most 314 KiB gzipped)
bun run test:browser  # the host-fixture leak test in Chromium (local only, not in CI)
bun run capture <dir> # 360 and 1440 px, light and dark, widget open
```

- The npm tarball ships `dist/index.js` and `dist/types` only (`files`). `loader.js`, the hashed
  bundle and `manifest.json` are the hosted artifacts the UI serves, not part of the npm package.
- `sideEffects: true`: importing the entry registers `<pulsarix-widget>`.
