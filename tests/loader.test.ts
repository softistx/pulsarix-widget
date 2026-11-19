import { expect, spyOn, test } from "bun:test";
import { join } from "node:path";

const g = globalThis as unknown as {
  __WIDGET_FILE__: string;
  __stubGate: Promise<void>;
  __stubMounts: number;
  __stubOpened: string[];
};

interface Api {
  init(o: { projectKey: string }): Promise<void>;
  open(): void;
  close(): void;
  identify(token: string | null): void;
  destroy(): void;
}
const pulsarix = () =>
  (window as unknown as { PulsarixWidget: Api }).PulsarixWidget;

test("destroy while the bundle loads cancels the mount", async () => {
  g.__WIDGET_FILE__ = join(import.meta.dir, "fixtures", "widget-stub.ts");
  g.__stubMounts = 0;
  let release = () => {};
  g.__stubGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // A classic script, not a module: imported for its side effect only.
  const loaderPath = "../src/loader";
  await import(loaderPath);
  const api = (
    window as unknown as {
      PulsarixWidget: {
        init(o: { projectKey: string }): Promise<void>;
        destroy(): void;
      };
    }
  ).PulsarixWidget;

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
  g.__WIDGET_FILE__ = join(import.meta.dir, "fixtures", "widget-stub.ts");
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
  g.__WIDGET_FILE__ = join(import.meta.dir, "fixtures", "widget-stub.ts");
  g.__stubMounts = 0;
  g.__stubGate = Promise.resolve();
  await api.init({ projectKey: "pk_live_abc" });
  expect(g.__stubMounts).toBe(1);
  warn.mockRestore();
  api.destroy();
});
