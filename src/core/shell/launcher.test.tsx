import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { App } from "../../app";
import type { AppProps } from "../../app-props";
import { MESSAGES } from "../messages";

afterEach(cleanup);

function renderApp(open: boolean, extra: Partial<AppProps> = {}) {
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
  const view = render(<App {...props} {...extra} open={open} />);
  return { view, props };
}

const launcherBox = () =>
  document.querySelector<HTMLElement>("[data-launcher]") as HTMLElement;

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

/** A controllable `matchMedia`: `setWidth` flips the query and tells the listeners. */
function fakeViewport(initial: number) {
  const realMatchMedia = window.matchMedia;
  const listeners = new Set<() => void>();
  let width = initial;
  window.matchMedia = ((query: string) => {
    const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Number.NaN);
    return {
      get matches() {
        return width <= max;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    setWidth(next: number) {
      width = next;
      act(() => {
        for (const fn of listeners) fn();
      });
    },
    restore() {
      window.matchMedia = realMatchMedia;
    },
  };
}

describe("the launcher's look", () => {
  const viewports: Array<ReturnType<typeof fakeViewport>> = [];
  afterEach(() => {
    for (const v of viewports.splice(0)) v.restore();
  });
  const at = (width: number) => {
    const v = fakeViewport(width);
    viewports.push(v);
    return v;
  };

  test("auto is the pill on a wide viewport and the icon on a narrow one", async () => {
    at(1440);
    renderApp(false);
    await screen.findByText(MESSAGES.en.launcher);
    expect(launcherBox().dataset.launcher).toBe("pill");
    cleanup();
    at(360);
    renderApp(false);
    expect(launcherBox().dataset.launcher).toBe("icon");
  });

  test("auto switches live when the viewport crosses 640 px", async () => {
    const viewport = at(1440);
    renderApp(false);
    await screen.findByText(MESSAGES.en.launcher);
    expect(launcherBox().dataset.launcher).toBe("pill");
    viewport.setWidth(639);
    expect(launcherBox().dataset.launcher).toBe("icon");
    viewport.setWidth(640);
    expect(launcherBox().dataset.launcher).toBe("pill");
  });

  test("the icon is a 48 px button named by the localized label, with a title", () => {
    at(360);
    renderApp(false);
    const button = screen.getByRole("button", { name: MESSAGES.en.launcher });
    expect(button.textContent).toBe("");
    expect(button.getAttribute("title")).toBe(MESSAGES.en.launcher);
    expect(button.className).toContain("size-[48px]");
    expect(button.className).toContain("focus-visible:ring");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  test("launcher=pill and launcher=icon ignore the viewport", () => {
    at(360);
    const pill = renderApp(false, { launcherMode: "pill" });
    expect(launcherBox().dataset.launcher).toBe("pill");
    pill.view.unmount();
    at(1440);
    renderApp(false, { launcherMode: "icon" });
    expect(launcherBox().dataset.launcher).toBe("icon");
  });

  test("the French label names the icon", () => {
    at(360);
    render(
      <App
        messages={MESSAGES.fr}
        locale="fr"
        projectKey="pk_live_abc"
        apiBase="https://pulsarix.test"
        dark={false}
        launcher
        position="bottom-right"
        open={false}
        onOpenChange={() => {}}
        onSubmitted={() => {}}
        onError={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: MESSAGES.fr.launcher }),
    ).not.toBeNull();
  });
});

describe("the launcher's offset", () => {
  test("its position reads the custom properties, with 16 px and the safe area as defaults", () => {
    renderApp(false);
    expect(launcherBox().className).toContain(
      "bottom-[calc(var(--pulsarix-launcher-bottom,16px)+env(safe-area-inset-bottom,0px))]",
    );
    expect(launcherBox().className).toContain(
      "right-(--pulsarix-launcher-side,16px)",
    );
    cleanup();
    renderApp(false, { position: "bottom-left" });
    expect(launcherBox().className).toContain(
      "left-(--pulsarix-launcher-side,16px)",
    );
  });
});

describe("the launcher's visibility", () => {
  test("launcherVisible=false hides the launcher but keeps it mounted", () => {
    renderApp(false, { launcherVisible: false });
    expect(launcherBox().hidden).toBe(true);
  });

  test("launcherVisible=false never hides an open dialog", async () => {
    renderApp(true, { launcherVisible: false });
    expect((await screen.findByRole("dialog")) !== null).toBe(true);
    expect(launcherBox().hidden).toBe(true);
  });
});
