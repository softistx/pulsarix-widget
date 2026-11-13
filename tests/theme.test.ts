import { expect, test } from "bun:test";
import { themeCssFor } from "../src/theme";

test("the seed generates tokens scoped to the widget's theme attribute", () => {
  const css = themeCssFor("#4f46e5");
  expect(css).toContain('[data-nxgt-theme="pulsarix"]');
  expect(css).toContain("--primary:");
  expect(css).not.toContain(":root");
});

test("another accent gives another stylesheet, the same accent the same bytes", () => {
  expect(themeCssFor("#0b7a75")).not.toBe(themeCssFor("#4f46e5"));
  expect(themeCssFor("#4f46e5")).toBe(themeCssFor("#4f46e5"));
});

test("dark tokens exist for the dark class on the scope element", () => {
  expect(themeCssFor("#4f46e5")).toContain(".dark");
});
