import { expect, test } from "bun:test";
import { join } from "node:path";

const g = globalThis as unknown as {
  __WIDGET_FILE__: string;
  __stubGate: Promise<void>;
  __stubMounts: number;
};

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
