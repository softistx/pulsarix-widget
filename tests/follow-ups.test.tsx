import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, type AppProps } from "../src/app";
import { MESSAGES } from "../src/messages";

const m = MESSAGES.en;
const realFetch = globalThis.fetch;
let reports: Array<{ input: Record<string, unknown> }> = [];

beforeEach(() => {
  reports = [];
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      id: string;
      variables: { input: Record<string, unknown> };
    };
    const data =
      body.id === "widgetConfig"
        ? { widgetConfig: null }
        : { submitClientReport: { reportId: "r1", tracking: false } };
    if (body.id !== "widgetConfig") reports.push(body.variables);
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

const base: AppProps = {
  messages: m,
  locale: "en",
  projectKey: "pk_live_abc",
  apiBase: "https://pulsarix.test",
  dark: false,
  open: true,
  launcher: false,
  position: "bottom-right",
  minFillMs: 0,
  onOpenChange: () => {},
  onSubmitted: () => {},
  onError: () => {},
};

const titleBox = () =>
  screen.getByRole("textbox", { name: /Title/ }) as HTMLInputElement;
const descriptionBox = () =>
  screen.getByRole("textbox", { name: /What happened/ }) as HTMLTextAreaElement;
const emailBox = () =>
  screen.getByRole("textbox", { name: /e-mail/i }) as HTMLInputElement;

describe("the draft", () => {
  test("survives closing the dialog and comes back at the next opening", async () => {
    const user = userEvent.setup();
    const view = render(<App {...base} />);
    await screen.findByRole("dialog");
    await user.type(titleBox(), "Checkout fails");
    await user.type(descriptionBox(), "Pay does nothing");
    view.rerender(<App {...base} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<App {...base} open />);
    await screen.findByRole("dialog");
    expect(titleBox().value).toBe("Checkout fails");
    expect(descriptionBox().value).toBe("Pay does nothing");
  });

  test("is cleared once the report is sent", async () => {
    const user = userEvent.setup();
    const view = render(<App {...base} />);
    await screen.findByRole("dialog");
    await user.type(titleBox(), "Crash");
    await user.type(descriptionBox(), "On save");
    await user.click(screen.getByRole("button", { name: m.submit }));
    await screen.findByText(m.done.noTracking);
    view.rerender(<App {...base} open={false} />);
    view.rerender(<App {...base} open />);
    await screen.findByRole("dialog");
    expect(titleBox().value).toBe("");
    expect(descriptionBox().value).toBe("");
  });
});

describe("prefill, metadata and the privacy link", () => {
  test("prefill fills the e-mail and the title, which the reporter can change", async () => {
    const user = userEvent.setup();
    render(
      <App
        {...base}
        prefill={{ email: "ada@example.com", title: "From the cart" }}
      />,
    );
    await screen.findByRole("dialog");
    expect(emailBox().value).toBe("ada@example.com");
    expect(titleBox().value).toBe("From the cart");
    await user.type(descriptionBox(), "Pay does nothing");
    await user.click(screen.getByRole("button", { name: m.submit }));
    await screen.findByText(m.done.noTracking);
    expect(reports[0]?.input).toMatchObject({
      email: "ada@example.com",
      title: "From the cart",
    });
  });

  test("metadata goes with the report as key and value entries", async () => {
    const user = userEvent.setup();
    render(<App {...base} metadata={[{ key: "plan", value: "pro" }]} />);
    await screen.findByRole("dialog");
    await user.type(titleBox(), "Crash");
    await user.type(descriptionBox(), "On save");
    await user.click(screen.getByRole("button", { name: m.submit }));
    await screen.findByText(m.done.noTracking);
    expect(reports[0]?.input.metadata).toEqual([{ key: "plan", value: "pro" }]);
  });

  test("no metadata key is sent when there is none", async () => {
    const user = userEvent.setup();
    render(<App {...base} />);
    await screen.findByRole("dialog");
    await user.type(titleBox(), "Crash");
    await user.type(descriptionBox(), "On save");
    await user.click(screen.getByRole("button", { name: m.submit }));
    await screen.findByText(m.done.noTracking);
    expect(reports[0]?.input).not.toHaveProperty("metadata");
  });

  test("the privacy line links the integrator's page, safely", async () => {
    render(<App {...base} privacyUrl="https://acme.test/privacy" />);
    await screen.findByRole("dialog");
    const link = screen.getByRole("link", { name: m.privacyLink });
    expect(link.getAttribute("href")).toBe("https://acme.test/privacy");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  test("without a privacy URL there is no link", async () => {
    render(<App {...base} />);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("link", { name: m.privacyLink })).toBeNull();
  });
});
