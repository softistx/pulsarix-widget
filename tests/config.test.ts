import { expect, test } from "bun:test";
import { apiBaseOf, isHexColor, readConfig } from "../src/config";

const read = (attrs: Record<string, string>) =>
  readConfig((name) => attrs[name] ?? null);

test("defaults: en, auto, bottom-right, no accent (lavande)", () => {
  expect(read({})).toEqual({
    projectKey: null,
    locale: "en",
    theme: "auto",
    position: "bottom-right",
    accentColor: null,
    apiBase: null,
    maskText: false,
  });
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
    apiBase: null,
    maskText: false,
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
  expect(config.accentColor).toBeNull();
});

test("only hex seeds are accepted", () => {
  expect(isHexColor("#abc")).toBe(true);
  expect(isHexColor("#AABBCC")).toBe(true);
  expect(isHexColor("rgb(1,2,3)")).toBe(false);
  expect(isHexColor("#abcd")).toBe(false);
  expect(isHexColor(null)).toBe(false);
});

test("apiBase keeps an http(s) origin and path, and drops anything else", () => {
  expect(apiBaseOf("https://pulsarix.example.com/")).toBe(
    "https://pulsarix.example.com",
  );
  expect(apiBaseOf("http://localhost:3000/api/")).toBe(
    "http://localhost:3000/api",
  );
  expect(apiBaseOf("javascript:alert(1)")).toBeNull();
  expect(apiBaseOf("nope")).toBeNull();
  expect(apiBaseOf(null)).toBeNull();
  expect(read({ "api-base": "https://p.example.com" }).apiBase).toBe(
    "https://p.example.com",
  );
});

test("mask-text is on only for the value true", () => {
  expect(read({ "mask-text": "true" }).maskText).toBe(true);
  expect(read({ "mask-text": "yes" }).maskText).toBe(false);
  expect(read({}).maskText).toBe(false);
});
