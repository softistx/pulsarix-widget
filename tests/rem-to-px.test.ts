import { expect, test } from "bun:test";
import { remToPx } from "../scripts/rem-to-px";

test("rem becomes px at 16px", () => {
  expect(remToPx(".a{margin:.25rem 1rem;width:calc(2.5rem*2)}")).toBe(
    ".a{margin:4px 16px;width:calc(40px*2)}",
  );
  expect(remToPx("@media (min-width:40rem){.b{top:-0.5rem}}")).toBe(
    "@media (min-width:640px){.b{top:-8px}}",
  );
});

test("other units and identifiers are left alone", () => {
  expect(remToPx(".c{width:10em;height:50%;--x:rem-token}")).toBe(
    ".c{width:10em;height:50%;--x:rem-token}",
  );
});

test("an escaped class name keeps its spelling", () => {
  expect(remToPx(".\\[--btn-px\\:0\\.25rem\\]{--btn-px:.25rem}")).toBe(
    ".\\[--btn-px\\:0\\.25rem\\]{--btn-px:4px}",
  );
});

test("a class name with a comma before its rem is not a declaration", () => {
  const css =
    ".gap-\\[var\\(--g\\,0\\.5rem\\)\\]{gap:var(--g,.5rem)}.px-\\[a\\,1rem\\]{top:1rem}";
  expect(remToPx(css)).toBe(
    ".gap-\\[var\\(--g\\,0\\.5rem\\)\\]{gap:var(--g,8px)}.px-\\[a\\,1rem\\]{top:16px}",
  );
});
