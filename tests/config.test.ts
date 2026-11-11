import { expect, test } from "bun:test";
import { DEFAULT_ACCENT, isHexColor, readConfig } from "../src/config";

const read = (attrs: Record<string, string>) =>
  readConfig((name) => attrs[name] ?? null);

test("defaults: en, auto, bottom-right, indigo seed", () => {
  expect(read({})).toEqual({
    projectKey: null,
    locale: "en",
    theme: "auto",
    position: "bottom-right",
    accentColor: DEFAULT_ACCENT,
  });
  expect(DEFAULT_ACCENT).toBe("#4f46e5");
});

test("valid attributes are taken", () => {
  expect(
    read({
      "project-key": "pk_live_x",
      locale: "fr",
      theme: "dark",
      position: "bottom-left",
      "accent-color": "#0b7a75",
    }),
  ).toEqual({
    projectKey: "pk_live_x",
    locale: "fr",
    theme: "dark",
    position: "bottom-left",
    accentColor: "#0b7a75",
  });
});

test("unknown values fall back, nothing throws", () => {
  const config = read({
    locale: "de",
    theme: "sepia",
    position: "top",
    "accent-color": "red; } body { display:none",
  });
  expect(config.locale).toBe("en");
  expect(config.theme).toBe("auto");
  expect(config.position).toBe("bottom-right");
  expect(config.accentColor).toBe(DEFAULT_ACCENT);
});

test("only hex seeds are accepted", () => {
  expect(isHexColor("#abc")).toBe(true);
  expect(isHexColor("#AABBCC")).toBe(true);
  expect(isHexColor("rgb(1,2,3)")).toBe(false);
  expect(isHexColor("#abcd")).toBe(false);
  expect(isHexColor(null)).toBe(false);
});
