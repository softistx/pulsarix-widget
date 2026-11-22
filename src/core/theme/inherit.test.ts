import { afterEach, describe, expect, test } from "bun:test";
import { mount, type WidgetHandle } from "../../mount";
import { inheritableTokens, isColor, readHostTheme } from "./inherit";

const html = document.documentElement;
let handle: WidgetHandle | null = null;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  handle?.destroy();
  handle = null;
  html.removeAttribute("style");
  html.removeAttribute("class");
  document.head.innerHTML = "";
});

const rootOf = (h: WidgetHandle) =>
  h.element.shadowRoot?.querySelector<HTMLElement>(".pulsarix-root");
const tokenOf = (h: WidgetHandle, name: string) =>
  rootOf(h)?.style.getPropertyValue(name) ?? "";

describe("the inheritable tokens", () => {
  test("come from the built-in theme: literal colours, radius, percentages; no font, no derived token", () => {
    const tokens = inheritableTokens();
    expect(tokens.get("--primary")).toBe("color");
    expect(tokens.get("--background")).toBe("color");
    expect(tokens.get("--radius")).toBe("length");
    expect(tokens.get("--indicator-lift")).toBe("percent");
    expect(tokens.has("--font-sans")).toBe(false);
    expect(tokens.has("--ground")).toBe(false);
    expect(tokens.has("--destructive")).toBe(false);
  });
});

describe("readHostTheme", () => {
  test("valid tokens are kept, an HSL triplet and junk are ignored, rem becomes px", () => {
    html.style.setProperty("--primary", "oklch(0.5 0.2 150)");
    html.style.setProperty("--background", "222 47% 11%");
    html.style.setProperty("--foreground", "not a colour");
    html.style.setProperty("--radius", "0.5rem");
    html.style.fontSize = "20px";
    const { tokens, dark } = readHostTheme(document, { accent: false });
    expect(tokens["--primary"]).toBe("oklch(0.5 0.2 150)");
    expect(tokens["--background"]).toBeUndefined();
    expect(tokens["--foreground"]).toBeUndefined();
    expect(tokens["--radius"]).toBe("10px");
    expect(dark).toBeNull();
  });

  test("hostile, odd and lookup values are rejected", () => {
    // (happy-dom splits "a; b" into two declarations, so the injection shapes are checked on isColor.)
    for (const bad of [
      "red; background:url(x)",
      "rgb(0 0 0)}",
      "rgb(0 0 0} body{color:red)",
      "rgb(0 0 0); x: y",
      "inherit",
      "currentcolor",
      "url(x)",
    ])
      expect(isColor(bad)).toBe(false);
    expect(isColor("oklch(0.5 0.2 150)")).toBe(true);
    html.style.setProperty("--background", "rgb(0 0 0)}");
    html.style.setProperty("--foreground", "rgb(0 0 0} body{color:red)");
    html.style.setProperty("--card", "inherit");
    html.style.setProperty("--border", "currentcolor");
    html.style.setProperty("--muted", "url(x)");
    html.style.setProperty("--accent", "#123456");
    const { tokens } = readHostTheme(document, { accent: false });
    expect(Object.keys(tokens)).toEqual(["--accent"]);
  });

  test("a host with nothing yields nothing", () => {
    expect(readHostTheme(document, { accent: false })).toEqual({
      tokens: {},
      dark: null,
    });
  });

  test("the host's scheme comes from its dark class, only when it gave tokens", () => {
    html.classList.add("dark");
    expect(readHostTheme(document, { accent: false }).dark).toBeNull();
    html.style.setProperty("--primary", "#00aa00");
    expect(readHostTheme(document, { accent: false }).dark).toBe(true);
  });
});

describe("the host's scheme", () => {
  test("color-scheme is the fallback, the light class beats it", () => {
    html.style.setProperty("--primary", "#00aa00");
    html.style.colorScheme = "dark";
    expect(readHostTheme(document, { accent: false }).dark).toBe(true);
    html.style.colorScheme = "light";
    expect(readHostTheme(document, { accent: false }).dark).toBe(false);
    html.style.colorScheme = "dark";
    html.classList.add("light");
    expect(readHostTheme(document, { accent: false }).dark).toBe(false);
  });

  test("data-theme and data-mode do not decide the scheme", () => {
    html.style.setProperty("--primary", "#00aa00");
    html.setAttribute("data-theme", "dark");
    html.setAttribute("data-mode", "dark");
    expect(readHostTheme(document, { accent: false }).dark).toBeNull();
    html.removeAttribute("data-theme");
    html.removeAttribute("data-mode");
  });
});

describe("the mounted widget", () => {
  test("a prefers-color-scheme change re-reads the tokens", async () => {
    const listeners: (() => void)[] = [];
    const real = window.matchMedia;
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    try {
      html.style.setProperty("--primary", "#0b7a75");
      handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
      await settle();
      html.style.setProperty("--primary", "#33ccbb");
      for (const fn of listeners) fn();
      await settle();
      expect(tokenOf(handle, "--primary")).toBe("#33ccbb");
    } finally {
      window.matchMedia = real;
    }
  });

  test("wears the host's tokens on its root; the rest keeps the widget's values", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
    await settle();
    expect(tokenOf(handle, "--primary")).toBe("#0b7a75");
    expect(tokenOf(handle, "--card")).toBe("");
  });

  test("an invalid host token falls back to the widget's own", async () => {
    html.style.setProperty("--primary", "222 47% 11%");
    handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
    await settle();
    expect(rootOf(handle)?.getAttribute("style") ?? "").not.toContain(
      "--primary",
    );
  });

  test("an explicit accentColor wins over the inherited primary, not over the other tokens", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    html.style.setProperty("--background", "#101010");
    handle = mount({
      projectKey: "pk",
      apiBase: "https://p.test",
      accentColor: "#aa3300",
    });
    await settle();
    expect(tokenOf(handle, "--primary")).toBe("");
    expect(tokenOf(handle, "--background")).toBe("#101010");
  });

  test("inheritTheme: false keeps today's look exactly", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    html.classList.add("dark");
    handle = mount({
      projectKey: "pk",
      apiBase: "https://p.test",
      inheritTheme: false,
      theme: "light",
    });
    await settle();
    expect(rootOf(handle)?.hasAttribute("style")).toBe(false);
    expect(rootOf(handle)?.classList.contains("dark")).toBe(false);
  });

  test("re-reads the tokens, and the scheme, when the host's html class changes", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
    await settle();
    expect(rootOf(handle)?.classList.contains("dark")).toBe(false);
    html.style.setProperty("--primary", "#33ccbb");
    html.classList.add("dark");
    await settle();
    await settle();
    expect(tokenOf(handle, "--primary")).toBe("#33ccbb");
    expect(rootOf(handle)?.classList.contains("dark")).toBe(true);
  });

  test("stops following the host after destroy()", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
    await settle();
    const root = rootOf(handle);
    handle.destroy();
    html.style.setProperty("--primary", "#33ccbb");
    await settle();
    await settle();
    expect(root?.style.getPropertyValue("--primary")).toBe("#0b7a75");
    handle = null;
  });

  test("turning the attribute off at run time drops the inherited tokens and the observer", async () => {
    html.style.setProperty("--primary", "#0b7a75");
    handle = mount({ projectKey: "pk", apiBase: "https://p.test" });
    await settle();
    handle.element.setAttribute("inherit-theme", "false");
    await settle();
    expect(tokenOf(handle, "--primary")).toBe("");
    html.style.setProperty("--primary", "#33ccbb");
    await settle();
    expect(tokenOf(handle, "--primary")).toBe("");
  });
});
