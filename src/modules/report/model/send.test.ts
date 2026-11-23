import { describe, expect, test } from "bun:test";
import {
  buildInput,
  capturePagesOf,
  collectUploads,
  type Upload,
} from "./send";

const values = {
  title: "t",
  description: "d",
  email: "",
  type: "",
  impact: "",
} as unknown as Parameters<typeof buildInput>[0]["values"];
const base = {
  values,
  locale: "en" as const,
  honeypot: "",
  filledInMs: 9,
  toSend: [],
};

describe("the page of each capture", () => {
  test("the first capture's page is the report's page, each one is a metadata entry", () => {
    const input = buildInput({
      ...base,
      capturePages: ["https://a.test/x", "https://a.test/y"],
    });
    expect(input.pageUrl).toBe("https://a.test/x");
    expect(input.metadata).toEqual([
      { key: "capture-1-page", value: "https://a.test/x" },
      { key: "capture-2-page", value: "https://a.test/y" },
    ]);
  });

  test("without a capture, the host's metadata is untouched and no capture key is sent", () => {
    const input = buildInput({
      ...base,
      metadata: [{ key: "plan", value: "pro" }],
    });
    expect(input.metadata).toEqual([{ key: "plan", value: "pro" }]);
  });

  test("the host's metadata gives way when the whole would pass the API's limits", () => {
    const host = Array.from({ length: 20 }, (_, i) => ({
      key: `k${i}`,
      value: "v",
    }));
    const input = buildInput({
      ...base,
      metadata: host,
      capturePages: ["https://a.test/x"],
    });
    expect(input.metadata).toHaveLength(20);
    expect(input.metadata?.at(-1)).toEqual({
      key: "capture-1-page",
      value: "https://a.test/x",
    });
  });

  test("a page longer than a metadata value is cut to it", () => {
    const input = buildInput({
      ...base,
      capturePages: [`https://a.test/${"x".repeat(900)}`],
    });
    expect(input.metadata?.[0]?.value.length).toBe(512);
  });

  test("capturePagesOf keeps the pages of the captures that go up, in order", () => {
    const ready = [
      { id: "1", pageUrl: "https://a.test/1" },
      { id: "2" },
      { id: "3", pageUrl: "https://a.test/3" },
    ];
    expect(capturePagesOf(ready, [{ id: "1" }, { id: "2" }] as never)).toEqual([
      "https://a.test/1",
    ]);
  });

  test("a capture with no page keeps its place in the numbering and sends no key", () => {
    const input = buildInput({
      ...base,
      capturePages: ["", "https://a.test/y"],
    });
    expect(input.pageUrl).not.toBe("");
    expect(input.metadata).toEqual([
      { key: "capture-2-page", value: "https://a.test/y" },
    ]);
  });

  test("a host entry shaped like a capture key gives way to the widget's", () => {
    const input = buildInput({
      ...base,
      metadata: [
        { key: "capture-1-page", value: "https://evil.test" },
        { key: "plan", value: "pro" },
      ],
      capturePages: ["https://a.test/x"],
    });
    expect(input.metadata).toEqual([
      { key: "plan", value: "pro" },
      { key: "capture-1-page", value: "https://a.test/x" },
    ]);
  });

  test("the host's metadata gives way to the byte limit too", () => {
    const host = [
      { key: "a", value: "x".repeat(500) },
      { key: "b", value: "x".repeat(500) },
      { key: "c", value: "x".repeat(500) },
      { key: "d", value: "x".repeat(500) },
    ];
    const input = buildInput({
      ...base,
      metadata: host,
      capturePages: ["https://a.test/x"],
    });
    const bytes = (input.metadata ?? []).reduce(
      (n, e) => n + e.key.length + e.value.length,
      0,
    );
    expect(bytes).toBeLessThanOrEqual(2048);
    expect(input.metadata?.at(-1)?.key).toBe("capture-1-page");
  });

  test("captures are named by position, files keep their own name", () => {
    const png = (name: string) => new File(["x"], name, { type: "image/png" });
    const toSend: Upload[] = [
      { id: "1", role: "screenshot", file: png("a.png"), capture: true },
      { id: "2", role: "file", file: png("b.png"), capture: true },
      { id: "3", role: "file", file: png("notes.png") },
    ];
    const input = buildInput({ ...base, toSend });
    expect(input.files?.map((f) => f.name)).toEqual([
      "screenshot.png",
      "screenshot-2.png",
      "notes.png",
    ]);
  });
});

describe("collectUploads", () => {
  const messages = { files: { screenshot: "Screenshot" } } as never;
  const png = new File(["x"], "screenshot.png", { type: "image/png" });

  test("the first capture is the screenshot, the next ones and the files are files", async () => {
    const { toSend, leftOut } = await collectUploads({
      controls: true,
      messages,
      ready: [
        { id: "f", file: png },
        { id: "1", file: png, pageUrl: "https://a.test/1" },
        { id: "2", file: png, pageUrl: "https://a.test/2" },
      ],
    });
    expect(leftOut).toEqual([]);
    expect(toSend.map((u) => [u.id, u.role])).toEqual([
      ["f", "file"],
      ["1", "screenshot"],
      ["2", "file"],
    ]);
  });

  test("nothing goes up without the attachment controls", async () => {
    const out = await collectUploads({
      controls: false,
      messages,
      ready: [{ id: "f", file: png }],
    });
    expect(out.toSend).toEqual([]);
  });
});
