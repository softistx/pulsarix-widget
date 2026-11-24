/**
 * Cuts the widget's icon sheet: dist/icons/duotone.svg, holding only the <symbol> elements named in
 * src/core/icons.ts, with the full sheet's ids (what InlineIconSprites looks up). The full sheet is a
 * licensed Font Awesome Pro file read from ICON_SPRITES_DIR (default: pulsarix-ui's
 * public/assets/icons/sprites); it is never committed and dist/icons is not in the npm package.
 * A missing source is a warning (CI and publish stay green, icons stay blank) unless REQUIRE_ICONS=1,
 * which makes it an error (the deploy build); a listed name absent from the source fails the build.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ICON_NAMES } from "../src/core/icons";

export const DEFAULT_SPRITES_DIR = join(
  process.env.HOME ?? "",
  "workspace/dev/pulsarix/pulsarix-ui/public/assets/icons/sprites",
);

/**
 * InlineIconSprites only keeps plain presentation attributes (no `style`, no value with a `(`), so
 * the sheet's `style="fill:var(--fa-secondary-color,currentColor);opacity:var(--fa-secondary-opacity,.4)"`
 * would be dropped and both layers would paint at full opacity. Each layer's style becomes the plain
 * `opacity` attribute holding its fallback (.4 for the secondary layer); the fill is inherited from
 * the svg's `fill-current`.
 *
 * Trade-off: the fixed .4 means a host-set dark tone or `--fa-secondary-opacity` no longer reaches
 * the layer. The sanitizer now keeps `opacity` and `--fa-*` (material #5675, merged, not yet
 * released); flattening can be revisited once that ships.
 */
export function flatten(symbol: string): string {
  return symbol.replace(/\sstyle="([^"]*)"/g, (_, style: string) => {
    const opacity =
      /opacity:var\(--fa-(?:primary|secondary)-opacity,\s*([\d.]+)\)/.exec(
        style,
      )?.[1];
    return opacity && Number(opacity) !== 1 ? ` opacity="${opacity}"` : "";
  });
}

/** The reduced sheet, or the names missing from the source. */
export function cutSprite(
  source: string,
  names: readonly string[],
): { svg: string } | { missing: string[] } {
  const symbols = new Map<string, string>();
  for (const match of source.matchAll(/<symbol\b[^>]*>[\s\S]*?<\/symbol>/g)) {
    const id = /\bid="([^"]+)"/.exec(match[0])?.[1];
    if (id) symbols.set(id, match[0]);
  }
  const missing = names.filter((name) => !symbols.has(name));
  if (missing.length > 0) return { missing };
  const body = names.map((name) => flatten(symbols.get(name) ?? "")).join("\n");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">\n${body}\n</svg>\n`,
  };
}

/** Writes dist/icons/duotone.svg; returns false when the source sheet is absent. */
export async function buildIconSprite(dist: string): Promise<boolean> {
  const dir = process.env.ICON_SPRITES_DIR ?? DEFAULT_SPRITES_DIR;
  const file = Bun.file(join(dir, "duotone.svg"));
  if (!(await file.exists())) {
    if (process.env.REQUIRE_ICONS === "1") {
      throw new Error(
        `icon sprite: ${join(dir, "duotone.svg")} not found and REQUIRE_ICONS=1`,
      );
    }
    console.warn(
      `icon sprite skipped: ${join(dir, "duotone.svg")} not found (set ICON_SPRITES_DIR); the widget's icons stay blank`,
    );
    return false;
  }
  const cut = cutSprite(await file.text(), ICON_NAMES);
  if ("missing" in cut) {
    throw new Error(
      `icon sprite: ${cut.missing.join(", ")} not in ${join(dir, "duotone.svg")}`,
    );
  }
  await mkdir(join(dist, "icons"), { recursive: true });
  await writeFile(join(dist, "icons/duotone.svg"), cut.svg);
  console.log(`built dist/icons/duotone.svg (${ICON_NAMES.length} icons)`);
  return true;
}
