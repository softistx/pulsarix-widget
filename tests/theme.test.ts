import { expect, test } from "bun:test";
import { themeToCss } from "@softistx/material-core/theme";
import { lavande } from "@softistx/material-core/theme/presets";
import { themeCssFor, themeNameFor } from "../src/theme";

test("no accent: the built-in lavande tokens, byte for byte", () => {
  const css = themeCssFor(null);
  expect(css).toBe(themeToCss(lavande, { header: false }).css);
  expect(css).toContain('[data-nxgt-theme="lavande"]');
  expect(css).toContain("--primary:");
  expect(css).not.toContain(":root");
  expect(themeNameFor(null)).toBe("lavande");
});

test("an accent seeds a theme scoped to the widget's attribute", () => {
  const css = themeCssFor("#0b7a75");
  expect(css).toContain('[data-nxgt-theme="pulsarix"]');
  expect(css).not.toContain(":root");
  expect(css).not.toBe(themeCssFor(null));
  expect(themeCssFor("#0b7a75")).toBe(css);
  expect(themeNameFor("#0b7a75")).toBe("pulsarix");
});

test("dark tokens exist for the dark class on the scope element", () => {
  expect(themeCssFor(null)).toContain(".dark");
  expect(themeCssFor("#0b7a75")).toContain(".dark");
});
