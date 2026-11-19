import { expect, test } from "bun:test";
import {
  apiBaseOf,
  isHexColor,
  metadataOf,
  privacyUrlOf,
  readConfig,
} from "../src/config";

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
    attachments: true,
    privacyUrl: null,
    prefill: { email: "", title: "" },
    metadata: [],
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
  ).toMatchObject({
    projectKey: "pk_live_x",
    locale: "fr",
    theme: "dark",
    position: "bottom-left",
    accentColor: "#0b7a75",
    apiBase: null,
    maskText: false,
    attachments: true,
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

test("attachments are on unless the attribute says false", () => {
  expect(read({ attachments: "false" }).attachments).toBe(false);
  expect(read({ attachments: "true" }).attachments).toBe(true);
  expect(read({ attachments: "no" }).attachments).toBe(true);
  expect(read({}).attachments).toBe(true);
});

test("privacy-url keeps only http(s) links", () => {
  expect(privacyUrlOf("https://acme.test/privacy")).toBe(
    "https://acme.test/privacy",
  );
  expect(privacyUrlOf("javascript:alert(1)")).toBeNull();
  expect(privacyUrlOf("not a url")).toBeNull();
  expect(privacyUrlOf(null)).toBeNull();
});

test("prefill attributes are trimmed and capped", () => {
  const config = read({
    "prefill-email": " ada@example.com ",
    "prefill-title": "t".repeat(300),
  });
  expect(config.prefill.email).toBe("ada@example.com");
  expect(config.prefill.title).toHaveLength(200);
});

test("metadata: flat values only, within the API's limits", () => {
  expect(metadataOf('{"plan":"pro","seats":3,"beta":true}')).toEqual([
    { key: "plan", value: "pro" },
    { key: "seats", value: "3" },
    { key: "beta", value: "true" },
  ]);
  expect(metadataOf('{"a":{"b":1},"c":null,"d":"ok"}')).toEqual([
    { key: "d", value: "ok" },
  ]);
  expect(metadataOf("[1]")).toEqual([]);
  expect(metadataOf("{broken")).toEqual([]);
  expect(metadataOf(null)).toEqual([]);
  const many = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`k${i}`, "v"]),
  );
  expect(metadataOf(JSON.stringify(many))).toHaveLength(20);
  const long = metadataOf(
    JSON.stringify({ ["k".repeat(100)]: "v".repeat(900) }),
  );
  expect(long[0]?.key).toHaveLength(64);
  expect(long[0]?.value).toHaveLength(512);
  // 2 KB in all: the entries that no longer fit are left out.
  const big = Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`k${i}`, "v".repeat(500)]),
  );
  const kept = metadataOf(JSON.stringify(big));
  expect(kept.length).toBeLessThan(10);
  expect(
    kept.reduce((n, e) => n + e.key.length + e.value.length, 0),
  ).toBeLessThanOrEqual(2_048);
});
