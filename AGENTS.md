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
  is a `devDependency`, so `dependencies` stays empty and a public install needs no GitHub
  Packages registry. The npm entry has `.d.ts` files (`tsconfig.build.json`, run by the build).
- `private: true` stays until the first publish (issue #10 adds the publish workflow).
- `mount()` is a singleton while its element is attached.
