import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { App } from "../../app";
import { MESSAGES } from "../messages";

afterEach(cleanup);

function renderApp(open: boolean) {
  const props = {
    messages: MESSAGES.en,
    locale: "en" as const,
    projectKey: "pk_live_abc",
    apiBase: "https://pulsarix.test",
    dark: false,
    launcher: true,
    position: "bottom-right" as const,
    onOpenChange: () => {},
    onSubmitted: () => {},
    onError: () => {},
  };
  const view = render(<App {...props} open={open} />);
  return { view, props };
}

const launcherBox = () =>
  document.querySelector<HTMLElement>(".fixed.bottom-4") as HTMLElement;

describe("the launcher", () => {
  test("is visible while the dialog is closed", async () => {
    renderApp(false);
    expect((await screen.findByText(MESSAGES.en.launcher)) !== null).toBe(true);
    expect(launcherBox().hidden).toBe(false);
  });

  test("is hidden while the dialog is open and shown again on close", async () => {
    const { view, props } = renderApp(true);
    await screen.findByRole("dialog");
    expect(launcherBox().hidden).toBe(true);
    view.rerender(<App {...props} open={false} />);
    expect(launcherBox().hidden).toBe(false);
  });
});

function Host() {
  const [open, setOpen] = useState(false);
  return (
    <App
      messages={MESSAGES.en}
      locale="en"
      projectKey="pk_live_abc"
      apiBase="https://pulsarix.test"
      dark={false}
      launcher
      position="bottom-right"
      open={open}
      onOpenChange={setOpen}
      onSubmitted={() => {}}
      onError={() => {}}
    />
  );
}

describe("focus", () => {
  test("opening from the launcher then pressing Escape puts focus back on it", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { widgetConfig: null } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<Host />);
    const launcher = await screen.findByRole("button", {
      name: MESSAGES.en.launcher,
    });
    await user.click(launcher);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    globalThis.fetch = realFetch;
  });
});
