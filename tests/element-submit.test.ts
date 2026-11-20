import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setDefaultTimeout,
  test,
} from "bun:test";
import { fireEvent, waitFor } from "@testing-library/react";
import { mount, type WidgetHandle } from "../src/element";

// The spam guard holds a submit for 3 s after the dialog opens.
setDefaultTimeout(15_000);

let handle: WidgetHandle | null = null;
const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { id: string };
    const data =
      body.id === "widgetConfig"
        ? { widgetConfig: null }
        : { submitClientReport: { reportId: "r1", tracking: false } };
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  handle?.destroy();
  handle = null;
  globalThis.fetch = realFetch;
  document.head.innerHTML = "";
});

describe("the host page's view of a sent report", () => {
  test("pulsarix:submit is a composed CustomEvent carrying the report's detail", async () => {
    handle = mount({
      projectKey: "pk_live_abc",
      apiBase: "https://pulsarix.test",
      launcher: false,
    });
    const events: CustomEvent[] = [];
    handle.element.addEventListener("pulsarix:submit", (e) =>
      events.push(e as CustomEvent),
    );
    handle.open();
    const shadow = handle.element.shadowRoot as ShadowRoot;
    await waitFor(() => expect(shadow.querySelector("form")).not.toBeNull());
    const title = shadow.querySelector(
      'input[name="title"]',
    ) as HTMLInputElement | null;
    const description = shadow.querySelector(
      'textarea[name="description"]',
    ) as HTMLTextAreaElement | null;
    expect(title).not.toBeNull();
    expect(description).not.toBeNull();
    fireEvent.change(title as HTMLInputElement, {
      target: { value: "Checkout" },
    });
    fireEvent.change(description as HTMLTextAreaElement, {
      target: { value: "Pay does nothing" },
    });
    fireEvent.submit(shadow.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(events).toHaveLength(1), { timeout: 8_000 });
    expect(events[0]).toBeInstanceOf(CustomEvent);
    expect(events[0]?.composed).toBe(true);
    expect(events[0]?.detail).toMatchObject({ reportId: "r1" });
  });
});
