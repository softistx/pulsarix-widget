import { afterAll, afterEach, beforeAll, expect, spyOn, test } from "bun:test";
import { join } from "node:path";

const g = globalThis as unknown as {
  __WIDGET_FILE__: string;
  __stubGate: Promise<void>;
  __stubMounts: number;
  __stubOpened: string[];
  __stubOptions?: unknown[];
};

interface Api {
  init(o: { projectKey: string }): Promise<void>;
  open(): void;
  close(): void;
  identify(token: string | null): void;
  setLauncherVisible(visible: boolean): void;
  destroy(): void;
}
const pulsarix = () =>
  (window as unknown as { PulsarixWidget: Api }).PulsarixWidget;

// The loader is a classic script: importing it registers the one global. Load it once for
// the file, whatever the order of the tests, and take every trace of it away afterwards.
beforeAll(async () => {
  const loaderPath = "./loader";
  await import(loaderPath);
});

afterEach(() => {
  pulsarix().destroy();
});

afterAll(() => {
  Reflect.deleteProperty(window, "PulsarixWidget");
  for (const key of [
    "__WIDGET_FILE__",
    "__stubGate",
    "__stubMounts",
    "__stubOpened",
    "__stubOptions",
  ]) {
    Reflect.deleteProperty(globalThis, key);
  }
});

test("destroy while the bundle loads cancels the mount", async () => {
  g.__WIDGET_FILE__ = join(
    import.meta.dir,
    "..",
    "tests",
    "fixtures",
    "widget-stub.ts",
  );
  g.__stubMounts = 0;
  let release = () => {};
  g.__stubGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = pulsarix();

  const first = api.init({ projectKey: "pk_live_abc" });
  api.destroy();
  release();
  await first;
  expect(g.__stubMounts).toBe(0);

  await api.init({ projectKey: "pk_live_abc" });
  expect(g.__stubMounts).toBe(1);
  api.destroy();
});

test("calls before the bundle loads are queued and replayed on mount", async () => {
  const opened: string[] = [];
  g.__WIDGET_FILE__ = join(
    import.meta.dir,
    "..",
    "tests",
    "fixtures",
    "widget-stub.ts",
  );
  g.__stubMounts = 0;
  g.__stubOpened = opened;
  let release = () => {};
  g.__stubGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = pulsarix();
  const loading = api.init({ projectKey: "pk_live_abc" });
  // A second init while loading returns the same promise and queues nothing.
  expect(api.init({ projectKey: "pk_live_abc" })).toBe(loading);
  api.open();
  api.close();
  api.identify("a.b");
  expect(opened).toEqual([]);
  release();
  await loading;
  expect(opened).toEqual(["open", "close", "identify:a.b"]);
  api.destroy();
});

test("a bundle that fails to load warns and lets init retry", async () => {
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  g.__WIDGET_FILE__ = join(import.meta.dir, "fixtures", "missing-bundle.ts");
  const api = pulsarix();
  await api.init({ projectKey: "pk_live_abc" });
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0]?.[0])).toContain("could not be loaded");
  // The failure leaves no stuck state: a later init tries again.
  g.__WIDGET_FILE__ = join(
    import.meta.dir,
    "..",
    "tests",
    "fixtures",
    "widget-stub.ts",
  );
  g.__stubMounts = 0;
  g.__stubGate = Promise.resolve();
  await api.init({ projectKey: "pk_live_abc" });
  expect(g.__stubMounts).toBe(1);
  warn.mockRestore();
  api.destroy();
});

const STUB = join(import.meta.dir, "..", "tests", "fixtures", "widget-stub.ts");

test("setLauncherVisible before the bundle loads is replayed on mount", async () => {
  const opened: string[] = [];
  g.__WIDGET_FILE__ = STUB;
  g.__stubMounts = 0;
  g.__stubOpened = opened;
  let release = () => {};
  g.__stubGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = pulsarix();
  const loading = api.init({ projectKey: "pk_live_abc" });
  api.setLauncherVisible(false);
  api.setLauncherVisible(true);
  expect(opened).toEqual([]);
  release();
  await loading;
  expect(opened).toEqual(["launcher:false", "launcher:true"]);
  api.setLauncherVisible(false);
  expect(opened.at(-1)).toBe("launcher:false");
});

test("destroy() clears the queued setLauncherVisible calls", async () => {
  const opened: string[] = [];
  g.__WIDGET_FILE__ = STUB;
  g.__stubMounts = 0;
  g.__stubOpened = opened;
  let release = () => {};
  g.__stubGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api = pulsarix();
  const first = api.init({ projectKey: "pk_live_abc" });
  api.setLauncherVisible(false);
  api.destroy();
  release();
  await first;
  // A fresh init mounts without the discarded call being replayed.
  g.__stubGate = Promise.resolve();
  await api.init({ projectKey: "pk_live_abc" });
  expect(g.__stubMounts).toBe(1);
  expect(opened).toEqual([]);
});

test("data-launcher and data-offset-* on the script tag reach mount", async () => {
  const options: unknown[] = [];
  g.__WIDGET_FILE__ = STUB;
  g.__stubMounts = 0;
  g.__stubOpened = [];
  g.__stubOptions = options;
  g.__stubGate = Promise.resolve();
  const script = document.createElement("script");
  Object.assign(script.dataset, {
    projectKey: "pk_live_abc",
    launcher: "icon",
    offsetBottom: "88",
    offsetSide: "1.5rem",
  });
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    get: () => script,
  });
  try {
    // A fresh copy of the loader reads the script tag at load, as a page's tag would.
    const fresh = "./loader?script-tag";
    await import(fresh);
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    Reflect.deleteProperty(document, "currentScript");
  }
  expect(options).toHaveLength(1);
  expect(options[0]).toMatchObject({
    projectKey: "pk_live_abc",
    launcher: "icon",
    offset: { bottom: "88", side: "1.5rem" },
  });
});
