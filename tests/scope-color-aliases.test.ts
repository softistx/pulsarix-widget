import { expect, test } from "bun:test";
import { scopeColorAliases } from "../scripts/scope-color-aliases";

test("the colour aliases are re-declared once each on the widget root", () => {
  const css =
    ":root,:host{--color-card:var(--card);--color-error:var(--error)}.x{--color-card:var(--card)}";
  const out = scopeColorAliases(css);
  expect(out.startsWith(css)).toBe(true);
  expect(
    out.endsWith(
      ".pulsarix-root{--color-card:var(--card);--color-error:var(--error)}",
    ),
  ).toBe(true);
});
