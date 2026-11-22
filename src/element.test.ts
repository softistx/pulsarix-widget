import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mount, type WidgetHandle } from "./mount";

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

  test("identify keeps the token out of the DOM; a malformed token reads as none; data-identity still works", () => {
    handle = mount({ projectKey: "pk_live_abc", identity: "a.b" });
    expect(handle.element.hasAttribute("identity")).toBe(false);
    expect(handle.element.config.identity).toBe("a.b");
    handle.identify("c.d");
    expect(handle.element.hasAttribute("identity")).toBe(false);
    expect(handle.element.config.identity).toBe("c.d");
    handle.identify("not a token");
    expect(handle.element.config.identity).toBeNull();
    handle.identify(null);
    expect(handle.element.config.identity).toBeNull();
    handle.element.setAttribute("identity", "e.f");
    expect(handle.element.config.identity).toBe("e.f");
    handle.identify(null);
    expect(handle.element.hasAttribute("identity")).toBe(false);
  });

  test("a second mount returns the first handle and adds no element", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    handle = mount({ projectKey: "pk_live_abc" });
    const second = mount({ projectKey: "pk_live_other" });
    expect(second).toBe(handle);
    expect(document.querySelectorAll("pulsarix-widget").length).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test("mounts again after destroy", () => {
    handle = mount({ projectKey: "pk_live_abc" });
    const first = handle;
    handle.destroy();
    handle = mount({ projectKey: "pk_live_abc" });
    expect(handle).not.toBe(first);
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

  test("pulsarix:error is a composed CustomEvent carrying { code }", async () => {
    handle = mount({ projectKey: "" });
    const events: CustomEvent[] = [];
    handle.element.addEventListener("pulsarix:error", (e) =>
      events.push(e as CustomEvent),
    );
    await settle();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CustomEvent);
    expect(events[0]?.composed).toBe(true);
    expect(events[0]?.detail).toEqual({ code: "config" });
  });

  test("open and close events are composed and carry a detail object", () => {
    handle = mount({ projectKey: "pk_live_abc", launcher: false });
    const events: CustomEvent[] = [];
    for (const name of ["pulsarix:open", "pulsarix:close"] as const)
      handle.element.addEventListener(name, (e) =>
        events.push(e as CustomEvent),
      );
    handle.open();
    handle.close();
    expect(events.map((e) => e.type)).toEqual([
      "pulsarix:open",
      "pulsarix:close",
    ]);
    for (const event of events) {
      expect(event.composed).toBe(true);
      expect(event.detail).toEqual({});
    }
  });

  test("prefill, metadata and privacyUrl reach the element's config", () => {
    handle = mount({
      projectKey: "pk_live_abc",
      launcher: false,
      privacyUrl: "https://acme.test/privacy",
      prefill: { email: "ada@example.com", title: "Hello" },
      metadata: { plan: "pro", seats: 3 },
    });
    expect(handle.element.config).toMatchObject({
      privacyUrl: "https://acme.test/privacy",
      prefill: { email: "ada@example.com", title: "Hello" },
      metadata: [
        { key: "plan", value: "pro" },
        { key: "seats", value: "3" },
      ],
    });
  });
});
