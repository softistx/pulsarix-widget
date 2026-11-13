import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mount, type WidgetHandle } from "../src/element";

let handle: WidgetHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.head.innerHTML = "";
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mount", () => {
  test("adds one element with an open shadow root and emits ready", async () => {
    handle = mount({ projectKey: "pk_live_abc", apiBase: "https://p.test" });
    const ready: Event[] = [];
    handle.on("pulsarix:ready", (e) => ready.push(e));
    await settle();
    expect(document.querySelectorAll("pulsarix-widget").length).toBe(1);
    expect(handle.element.shadowRoot).not.toBeNull();
    expect(ready.length).toBe(1);
  });

  test("a second mount returns the first handle and adds no element", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    handle = mount({ projectKey: "pk_live_abc" });
    const second = mount({ projectKey: "pk_live_other" });
    expect(second).toBe(handle);
    expect(document.querySelectorAll("pulsarix-widget").length).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("mounts again after destroy", () => {
    handle = mount({ projectKey: "pk_live_abc" });
    handle.destroy();
    handle = mount({ projectKey: "pk_live_abc" });
    expect(document.querySelectorAll("pulsarix-widget").length).toBe(1);
  });

  test("a missing project key reports a config error", async () => {
    handle = mount({ projectKey: "" });
    const codes: string[] = [];
    handle.on("pulsarix:error", (e) => codes.push(e.detail.code));
    await settle();
    expect(codes).toEqual(["config"]);
  });

  test("open and close emit their events once", async () => {
    handle = mount({ projectKey: "pk_live_abc", launcher: false });
    const seen: string[] = [];
    handle.on("pulsarix:open", () => seen.push("open"));
    handle.on("pulsarix:close", () => seen.push("close"));
    handle.open();
    handle.open();
    handle.close();
    expect(seen).toEqual(["open", "close"]);
    expect(handle.element.isOpen).toBe(false);
  });

  test("the off function stops a listener", () => {
    handle = mount({ projectKey: "pk_live_abc", launcher: false });
    const seen: string[] = [];
    const off = handle.on("pulsarix:open", () => seen.push("open"));
    off();
    handle.open();
    expect(seen).toEqual([]);
  });

  test("removal cleans up: adopted sheets released, state reset", async () => {
    handle = mount({ projectKey: "pk_live_abc" });
    await settle();
    const shadow = handle.element.shadowRoot as ShadowRoot;
    handle.open();
    handle.destroy();
    expect(document.querySelectorAll("pulsarix-widget").length).toBe(0);
    expect(handle.element.isOpen).toBe(false);
    expect(shadow.adoptedStyleSheets?.length ?? 0).toBe(0);
  });
});
