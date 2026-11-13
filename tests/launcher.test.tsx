import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "../src/app";
import { MESSAGES } from "../src/messages";

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
