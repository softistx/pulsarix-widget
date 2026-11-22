import { describe, expect, test } from "bun:test";
import { buildInput, capturePagesOf } from "./send";

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
});
