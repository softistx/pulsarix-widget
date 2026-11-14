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
- The shipped declarations are only those reachable from `dist/types/index.d.ts` (`index`,
  `config`, `element`), listed in `files`; they must import nothing but each other (no `react`,
  no `react-hook-form`, no generated CSS). If `index.d.ts` starts to reach another file, add it to
  `files` and keep the throwaway-tsconfig check (`skipLibCheck: false`, no react installed) clean.
- Release (never npmjs; no publish workflow): from an up-to-date `develop` worktree, bump
  `version` in `package.json`, merge that PR, then `bun run verify && bun run release`
  (`scripts/publish.ts`). It dual-publishes: npm.softistx.com first (primary, `publishConfig`,
  token `NPM_REGISTRY_PUBLISH_TOKEN`), then GitHub Packages (kept for 30 days from 2026-11-14,
  token `GITHUB_TOKEN` or `gh auth token` with `write:packages`), skipping a registry that already
  has the version. Then tag: `git tag v<version> && git push origin v<version>`, and check the
  version on both: `npm view @softistx/pulsarix-widget version --registry https://npm.softistx.com`
  and `--registry https://npm.pkg.github.com`. Installs read `@softistx` from npm.softistx.com
  (`bunfig.toml`, `$NPM_REGISTRY_TOKEN`).
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
