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
