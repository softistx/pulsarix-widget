import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ICON_NAMES } from "../src/core/icons";
import { buildIconSprite, cutSprite } from "./icon-sprite";

const SHEET = `<svg xmlns="http://www.w3.org/2000/svg" style="display: none;"><symbol id="bug" viewBox="0 0 576 512"><path style="fill:var(--fa-primary-color,currentColor);opacity:var(--fa-primary-opacity,1)" d="a"/></symbol>
<symbol id="ban" viewBox="0 0 512 512"><path style="fill:var(--fa-secondary-color,currentColor);opacity:var(--fa-secondary-opacity,.4)" d="b"/></symbol><symbol id="x" viewBox="0 0 1 1"><path d="c"/></symbol></svg>`;

describe("cutSprite", () => {
  test("keeps only the listed symbols, with their ids", () => {
    const cut = cutSprite(SHEET, ["bug", "ban"]);
    if (!("svg" in cut)) throw new Error("expected a sprite");
    expect(cut.svg).toContain('<symbol id="bug" viewBox="0 0 576 512">');
    expect(cut.svg).toContain('id="ban"');
    expect(cut.svg).not.toContain('id="x"');
    expect(cut.svg.startsWith("<svg")).toBe(true);
    // The tones keep their style: material's InlineIconSprites keeps opacity and --fa-* (#5675).
    expect(cut.svg).toContain("opacity:var(--fa-secondary-opacity,.4)");
  });

  test("reports every missing name", () => {
    expect(cutSprite(SHEET, ["bug", "nope", "zip"])).toEqual({
      missing: ["nope", "zip"],
    });
  });
});

describe("buildIconSprite", () => {
  const saved = {
    dir: process.env.ICON_SPRITES_DIR,
    require: process.env.REQUIRE_ICONS,
  };
  const temp: string[] = [];
  afterEach(async () => {
    for (const [key, value] of [
      ["ICON_SPRITES_DIR", saved.dir],
      ["REQUIRE_ICONS", saved.require],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const dir of temp.splice(0)) await rm(dir, { recursive: true });
  });
  async function scratch(sheet?: string) {
    const root = await mkdtemp(join(tmpdir(), "icon-sprite-"));
    temp.push(root);
    const sprites = join(root, "sprites");
    process.env.ICON_SPRITES_DIR = sprites;
    if (sheet !== undefined) {
      await Bun.write(join(sprites, "duotone.svg"), sheet);
    }
    return { root, dist: join(root, "dist") };
  }
  const sheetOf = (names: readonly string[]) =>
    `<svg>${names.map((n) => `<symbol id="${n}" viewBox="0 0 1 1"><path d="a"/></symbol>`).join("")}</svg>`;

  test("skips when the source is absent", async () => {
    const { dist } = await scratch();
    delete process.env.REQUIRE_ICONS;
    expect(await buildIconSprite(dist)).toBe(false);
    expect(existsSync(join(dist, "icons/duotone.svg"))).toBe(false);
  });

  test("throws when the source is absent and REQUIRE_ICONS=1", async () => {
    const { dist } = await scratch();
    process.env.REQUIRE_ICONS = "1";
    await expect(buildIconSprite(dist)).rejects.toThrow("REQUIRE_ICONS");
  });

  test("throws when a name is missing from the source", async () => {
    const { dist } = await scratch(sheetOf(ICON_NAMES.slice(1)));
    await expect(buildIconSprite(dist)).rejects.toThrow(ICON_NAMES[0]);
  });

  test("writes the reduced sheet", async () => {
    const { dist } = await scratch(sheetOf([...ICON_NAMES, "extra"]));
    expect(await buildIconSprite(dist)).toBe(true);
    const svg = await Bun.file(join(dist, "icons/duotone.svg")).text();
    expect(svg).toContain(`id="${ICON_NAMES[0]}"`);
    expect(svg).not.toContain('id="extra"');
  });
});
