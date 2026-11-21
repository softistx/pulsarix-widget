/**
 * Fails when the loader is over its budget (at most 5 KB gzipped, slice W0), or when the main
 * widget bundle is over its own (slice W2).
 */

import { join } from "node:path";
import { gzipSync } from "node:zlib";

const LOADER_BUDGET = 5 * 1024;
// Main bundle (dist/widget.<hash>.js) gzipped at level 9. Measured 291 649 B (about 284.8 KiB)
// on the W2 build; budget = measured + about 10 %, raised to a whole KiB.
const WIDGET_BUDGET = 314 * 1024;
const root = join(import.meta.dir, "..", "dist");

const loader = await Bun.file(join(root, "loader.js")).bytes();
const gz = gzipSync(loader, { level: 9 }).length;
const manifest = await Bun.file(join(root, "manifest.json")).json();
const widget = await Bun.file(join(root, manifest.widget)).bytes();
const widgetGz = gzipSync(widget, { level: 9 }).length;

console.log(
  `loader.js ${loader.length} B, ${gz} B gzipped (budget ${LOADER_BUDGET} B)`,
);
console.log(
  `${manifest.widget} ${(widget.length / 1024).toFixed(0)} KB, ${(widgetGz / 1024).toFixed(1)} KB gzipped (budget ${WIDGET_BUDGET / 1024} KB)`,
);
for (const chunk of manifest.chunks ?? []) {
  const bytes = await Bun.file(join(root, chunk)).bytes();
  console.log(
    `${chunk} ${(bytes.length / 1024).toFixed(0)} KB, ${(gzipSync(bytes).length / 1024).toFixed(0)} KB gzipped (informational)`,
  );
}
if (gz > LOADER_BUDGET) {
  console.error("the loader is over its gzipped budget");
  process.exit(1);
}
if (widgetGz > WIDGET_BUDGET) {
  console.error("the main widget bundle is over its gzipped budget");
  process.exit(1);
}
