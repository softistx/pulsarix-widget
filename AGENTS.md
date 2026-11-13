# pulsarix-widget

The owner's rules for every repository are in `~/.claude/CLAUDE.md`. The conventions follow
operix-ui (`~/workspace/dev/operix/operix-ui/AGENTS.md`). This file states only the widget's
invariants.

- The loader stays at 5 KB gzipped or less (`scripts/check-size.ts`).
- Exactly one global, `PulsarixWidget` (the leak test, `bun run test:browser`).
- No `rem` lengths in the built CSS (`tests/build.test.ts`).
- No document-level styles: everything stays inside the shadow root.
- Requests use `credentials: "omit"`.
- The page URL is sent without its query or fragment (`location.origin + location.pathname`).
- The package is self-contained: everything `dist/` inlines (React, `@softistx/material`, ...)
  is a `devDependency`, so `dependencies` stays empty and the package itself has no
  runtime dependencies. The npm entry has `.d.ts` files (`tsconfig.build.json`, run by the build).
- Release (GitHub Packages only, never npmjs; no publish workflow, no npm token): from an
  up-to-date `develop` worktree, bump `version` in `package.json` (and the changelog if any), merge
  that PR, run `bun run verify` (the green bar), then `bun run build && bun publish` (registry and access come
  from `publishConfig`). Afterwards check the version with
  `npm view @softistx/pulsarix-widget version --registry https://npm.pkg.github.com`.
- `mount()` is a singleton while its element is attached.

## Develop

```sh
bun run verify        # lint, build, typecheck, unit tests, loader size (at most 5 KB gzipped)
bun run test:browser  # the host-fixture leak test in Chromium (local only, not in CI)
bun run capture <dir> # 360 and 1440 px, light and dark, widget open
```

- The npm tarball ships `dist/index.js` and `dist/types` only (`files`). `loader.js`, the hashed
  bundle and `manifest.json` are the hosted artifacts the UI serves, not part of the npm package.
- `sideEffects: true`: importing the entry registers `<pulsarix-widget>`.
