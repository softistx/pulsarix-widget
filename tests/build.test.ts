import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dir, "..", "dist");

// Runs after `bun run build` (verify orders them): the loader and the bundle agree.
test.skipIf(!existsSync(join(dist, "manifest.json")))(
  "the loader points at the hashed bundle in the manifest",
  async () => {
    const manifest = await Bun.file(join(dist, "manifest.json")).json();
    const loader = await Bun.file(join(dist, manifest.loader)).text();
    expect(manifest.widget).toMatch(/^widget\.[a-z0-9]+\.js$/);
    expect(loader).toContain(manifest.widget);
    expect(loader).not.toContain("__WIDGET_FILE__");
    expect(existsSync(join(dist, manifest.widget))).toBe(true);
  },
);

// The host's root font size is the host's to choose: no rem unit may survive in a declaration
// of the built stylesheet. Not counted: class names (selectors such as `.h-\[calc\(2\.25rem`),
// the `var()` fallbacks of the utilities (embed.css defines every token, so they are never
// read) and Tailwind's unused `.container` rules.
const generatedCss = join(import.meta.dir, "..", "src/generated/widget-css.ts");
test.skipIf(!existsSync(generatedCss))(
  "the built stylesheet declares no rem length",
  async () => {
    const module = (await import(generatedCss)) as { default: string };
    const declarations = module.default
      .replace(/\.container\{[^}]*\}/g, "")
      .replace(/var\(--[a-z0-9-]+,[^)]*\)/g, "var()")
      .match(/\{[^{}]*\}/g);
    const withRem = (declarations ?? []).filter((d) => /[0-9.]rem\b/.test(d));
    expect(withRem).toEqual([]);
  },
);
