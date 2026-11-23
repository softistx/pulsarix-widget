import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { App } from "../../app";
import type { AppProps } from "../../app-props";
import { MESSAGES } from "../messages";
import { Launcher } from "./launcher";

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
    expect(
      (await screen.findByRole("button", { name: MESSAGES.en.launcher })) !==
        null,
    ).toBe(true);
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

/** A host that hides the launcher once the dialog opens, so the opener sits inside [hidden]. */
function HiddenOnOpenHost() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  return (
    <App
      messages={MESSAGES.en}
      locale="en"
      projectKey="pk_live_abc"
      apiBase="https://pulsarix.test"
      dark={false}
      launcher
      launcherVisible={visible}
      position="bottom-right"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setVisible(false);
      }}
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

  test("with the launcher hidden meanwhile, closing does not force focus onto it", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { widgetConfig: null } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const user = userEvent.setup();
    // The host hides the launcher while the dialog is open: the opener ends up inside [hidden].
    render(<HiddenOnOpenHost />);
    await user.click(
      await screen.findByRole("button", { name: MESSAGES.en.launcher }),
    );
    await screen.findByRole("dialog");
    // The opener is hidden: the app's own handler must not be the one that focuses it, so the
    // dialog's default close focus runs (the call comes from the library, not from app.tsx).
    const focusedBy: string[] = [];
    const realFocus = HTMLElement.prototype.focus;
    const focus = spyOn(HTMLElement.prototype, "focus").mockImplementation(
      function (this: HTMLElement, ...args) {
        if (launcherBox().contains(this))
          focusedBy.push(new Error().stack ?? "");
        return realFocus.apply(this, args);
      },
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(launcherBox().hidden).toBe(true);
    focus.mockRestore();
    expect(focusedBy.some((stack) => /src\/app\.tsx/.test(stack))).toBe(false);
    globalThis.fetch = realFetch;
  });
});

describe("the launcher's look", () => {
  test("is one round FAB at every width, named by the localized label", () => {
    renderApp(false);
    expect(launcherBox().dataset.launcher).toBe("fab");
    const button = screen.getByRole("button", { name: MESSAGES.en.launcher });
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
  });

  test("every launcher mode renders the FAB", () => {
    for (const launcherMode of ["auto", "pill", "icon"] as const) {
      const { view } = renderApp(false, { launcherMode } as Partial<AppProps>);
      expect(launcherBox().dataset.launcher).toBe("fab");
      view.unmount();
    }
  });

  test("the French label names the FAB", () => {
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

describe("the launcher for an identified reporter", () => {
  test("opens a menu with the two views", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { widgetConfig: null } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const user = userEvent.setup();
    renderApp(false, { identity: "tok" });
    await user.click(
      screen.getByRole("button", { name: MESSAGES.en.launcher }),
    );
    expect(
      (await screen.findByRole("menuitem", { name: MESSAGES.en.title })) !==
        null,
    ).toBe(true);
    expect(
      screen.getByRole("menuitem", { name: MESSAGES.en.myRequests }) !== null,
    ).toBe(true);
    globalThis.fetch = realFetch;
  });
});

describe("the unread count in the FAB's name", () => {
  const launcher = (identified: boolean, locale: "en" | "fr") => (
    <Launcher
      messages={MESSAGES[locale]}
      position="bottom-right"
      open={false}
      unread={2}
      identified={identified}
      fabRef={createRef<HTMLButtonElement>()}
      onReport={() => {}}
      onRequests={() => {}}
    />
  );

  test("is in the FAB's accessible name, anonymous or identified, in both languages", () => {
    for (const identified of [false, true]) {
      for (const locale of ["en", "fr"] as const) {
        const { unmount } = render(launcher(identified, locale));
        expect(
          screen.getByRole("button", {
            name: `${MESSAGES[locale].launcher}, 2`,
          }),
        ).toBeTruthy();
        unmount();
      }
    }
  });
});
