import { describe, expect, test } from "bun:test";
import { cutSprite } from "./icon-sprite";

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
    // Two tones, as plain attributes (InlineIconSprites drops style and any value with a "(").
    expect(cut.svg).toContain('<path opacity=".4" d="b"/>');
    expect(cut.svg).not.toContain('style="fill');
    expect(cut.svg).not.toContain("var(");
  });

  test("reports every missing name", () => {
    expect(cutSprite(SHEET, ["bug", "nope", "zip"])).toEqual({
      missing: ["nope", "zip"],
    });
  });
});
