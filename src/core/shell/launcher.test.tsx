import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { App } from "../../app";
import type { AppProps } from "../../app-props";
import { MESSAGES } from "../messages";
import { Launcher } from "./launcher";
import {
  BOTTOM_GAP,
  TAB_SIZE,
  TOP_GAP,
  topOf as topFor,
} from "./launcher-position";

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // no storage in this environment
  }
});

function renderApp(open: boolean, extra: Partial<AppProps> = {}) {
  const props = {
    messages: MESSAGES.en,
    locale: "en" as const,
    projectKey: "pk_live_abc",
    apiBase: "https://pulsarix.test",
    dark: false,
    launcher: true,
    onOpenChange: () => {},
    onSubmitted: () => {},
    onError: () => {},
  };
  const view = render(<App {...props} {...extra} open={open} />);
  return { view, props };
}

const topOf = (box: HTMLElement) => Number.parseFloat(box.style.top);
const topOfRatio = (ratio: number) => topFor(ratio, window.innerHeight);

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
  test("is one 44 px icon button with no visible text, named by the localized label", () => {
    renderApp(false);
    expect(launcherBox().dataset.launcher).toBe("tab");
    const button = screen.getByRole("button", { name: MESSAGES.en.launcher });
    expect(button.querySelector("svg")).not.toBeNull();
    // The label is the tooltip only, hidden from assistive technology.
    expect(
      button.querySelector("[data-tip]")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  test("every launcher mode renders the tab", () => {
    for (const launcherMode of ["auto", "pill", "icon"] as const) {
      const { view } = renderApp(false, { launcherMode } as Partial<AppProps>);
      expect(launcherBox().dataset.launcher).toBe("tab");
      view.unmount();
    }
  });

  test("the French label names the tab", () => {
    renderApp(false, { messages: MESSAGES.fr, locale: "fr" });
    expect(
      screen.getByRole("button", { name: MESSAGES.fr.launcher }),
    ).not.toBeNull();
  });

  test("carries aria-expanded, aria-controls and aria-keyshortcuts", () => {
    renderApp(false);
    const button = screen.getByRole("button", { name: MESSAGES.en.launcher });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("pulsarix-dock");
    expect(button.getAttribute("aria-keyshortcuts")).toBe(
      "Alt+ArrowUp Alt+ArrowDown",
    );
  });
});

describe("the launcher's side and starting height", () => {
  test("defaults to the right edge, halfway down", () => {
    renderApp(false);
    expect(launcherBox().dataset.side).toBe("right");
    expect(topOf(launcherBox())).toBe(topOfRatio(0.5));
  });

  test("the left side and the host's offset are used", () => {
    renderApp(false, { placement: { side: "left", offset: 0.2 } });
    expect(launcherBox().dataset.side).toBe("left");
    expect(topOf(launcherBox())).toBe(topOfRatio(0.2));
  });

  test("an offset past the ends is clamped inside the viewport", () => {
    renderApp(false, { placement: { side: "right", offset: 3 } });
    expect(topOf(launcherBox())).toBe(topOfRatio(1));
    expect(topOf(launcherBox())).toBeLessThanOrEqual(
      window.innerHeight - BOTTOM_GAP - TAB_SIZE,
    );
    cleanup();
    renderApp(false, { placement: { side: "right", offset: -2 } });
    expect(topOf(launcherBox())).toBe(TOP_GAP);
  });

  test("stays clamped when the window is resized", () => {
    renderApp(false, { placement: { side: "right", offset: 1 } });
    const before = window.innerHeight;
    act(() => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 300,
      });
      window.dispatchEvent(new Event("resize"));
    });
    expect(topOf(launcherBox())).toBe(300 - BOTTOM_GAP - TAB_SIZE);
    act(() => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: before,
      });
      window.dispatchEvent(new Event("resize"));
    });
  });
});

const tabButton = () =>
  screen.getByRole("button", {
    name: new RegExp(`^(${MESSAGES.en.launcher}|${MESSAGES.en.launcherMenu})`),
  });

describe("moving the launcher", () => {
  test("a drag moves it, and never opens the dialog", async () => {
    const opened: boolean[] = [];
    renderApp(false, { onOpenChange: (next) => opened.push(next) });
    const button = tabButton();
    const start = topOf(launcherBox());
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 360, pointerId: 1 });
    expect(launcherBox().dataset.dragging).toBe("true");
    expect(topOf(launcherBox())).toBe(start + 60);
    fireEvent.pointerUp(button, { clientY: 360, pointerId: 1 });
    // The click the browser fires after a drag.
    fireEvent.click(button);
    expect(opened).toEqual([]);
    expect(launcherBox().dataset.dragging).toBeUndefined();
    // A later click is a real one again.
    await new Promise((resolve) => setTimeout(resolve, 5));
    fireEvent.click(button);
    expect(opened).toEqual([true]);
  });

  test("the click after a drag is consumed once, with no timer; the next one opens", () => {
    const opened: boolean[] = [];
    renderApp(false, { onOpenChange: (next) => opened.push(next) });
    const button = tabButton();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 360, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 360, pointerId: 1 });
    fireEvent.click(button);
    expect(opened).toEqual([]);
    fireEvent.click(button);
    expect(opened).toEqual([true]);
  });

  test("the end of a drag saves the position per host origin", () => {
    renderApp(false);
    const button = tabButton();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 360, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 360, pointerId: 1 });
    const saved = JSON.parse(
      localStorage.getItem(`pulsarix-widget:launcher:${location.origin}`) ??
        "null",
    );
    expect(typeof saved.offset).toBe("number");
    expect(saved.offset).not.toBe(0.5);
  });

  test("a small pointer move is still a click", () => {
    const opened: boolean[] = [];
    renderApp(false, { onOpenChange: (next) => opened.push(next) });
    const button = tabButton();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 302, pointerId: 1 });
    fireEvent.pointerUp(button, { clientY: 302, pointerId: 1 });
    fireEvent.click(button);
    expect(opened).toEqual([true]);
  });

  test("a drag past the ends stays inside the viewport", () => {
    renderApp(false);
    const button = tabButton();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: -5000, pointerId: 1 });
    expect(topOf(launcherBox())).toBe(TOP_GAP);
    fireEvent.pointerMove(button, { clientY: 9000, pointerId: 1 });
    expect(topOf(launcherBox())).toBe(topOfRatio(1));
    fireEvent.pointerUp(button, { pointerId: 1 });
  });

  test("Alt+ArrowUp and Alt+ArrowDown move it, and each move is announced", async () => {
    renderApp(false);
    const button = tabButton();
    const start = topOf(launcherBox());
    fireEvent.keyDown(button, { key: "ArrowUp", altKey: true });
    expect(topOf(launcherBox())).toBeLessThan(start);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        MESSAGES.en.launcherMoved(45),
      ),
    );
    fireEvent.keyDown(button, { key: "ArrowDown", altKey: true });
    fireEvent.keyDown(button, { key: "ArrowDown", altKey: true });
    expect(topOf(launcherBox())).toBeGreaterThan(start);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        MESSAGES.en.launcherMoved(55),
      ),
    );
  });

  test("keyboard moves stop at the ends", () => {
    renderApp(false, { placement: { side: "right", offset: 0 } });
    fireEvent.keyDown(tabButton(), { key: "ArrowUp", altKey: true });
    expect(topOf(launcherBox())).toBe(TOP_GAP);
  });

  test("a plain arrow key without Alt does not move it", () => {
    renderApp(false);
    const start = topOf(launcherBox());
    fireEvent.keyDown(tabButton(), { key: "ArrowUp" });
    expect(topOf(launcherBox())).toBe(start);
  });

  test("the position is saved per host origin and restored", () => {
    renderApp(false);
    fireEvent.keyDown(tabButton(), { key: "ArrowDown", altKey: true });
    const saved = localStorage.getItem(
      `pulsarix-widget:launcher:${location.origin}`,
    );
    expect(JSON.parse(saved ?? "null")).toEqual({ offset: 0.55 });
    const moved = topOf(launcherBox());
    cleanup();
    renderApp(false, { placement: { side: "right", offset: 0.1 } });
    expect(topOf(launcherBox())).toBe(moved);
  });

  test("an unreadable or blocked storage never breaks the launcher", () => {
    localStorage.setItem(
      `pulsarix-widget:launcher:${location.origin}`,
      "{nope",
    );
    renderApp(false);
    expect(topOf(launcherBox())).toBe(topOfRatio(0.5));
    cleanup();
    const get = spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderApp(false);
    fireEvent.keyDown(tabButton(), { key: "ArrowDown", altKey: true });
    expect(topOf(launcherBox())).toBeGreaterThan(topOfRatio(0.5));
    get.mockRestore();
    set.mockRestore();
  });

  test("the tooltip is hidden while dragging (and the tab slides fully in)", () => {
    renderApp(false);
    const button = tabButton();
    expect(launcherBox().dataset.dragging).toBeUndefined();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 340, pointerId: 1 });
    // The stylesheet hides the tip under `[data-dragging]`; the state it keys on is set.
    expect(launcherBox().hasAttribute("data-dragging")).toBe(true);
    expect(button.querySelector("[data-tip]")).not.toBeNull();
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(launcherBox().hasAttribute("data-dragging")).toBe(false);
  });

  test("the tooltip has the label and the drag hint", () => {
    renderApp(false);
    const tip = tabButton().querySelector("[data-tip]");
    expect(tip?.textContent).toBe(
      `${MESSAGES.en.launcher}${MESSAGES.en.launcherHint}${MESSAGES.en.launcherKeyHint}`,
    );
    // Hover shows the drag hint, keyboard focus the keyboard one.
    expect(tip?.querySelector("[data-hint=drag]")?.textContent).toBe(
      MESSAGES.en.launcherHint,
    );
    expect(tip?.querySelector("[data-hint=key]")?.textContent).toBe(
      MESSAGES.en.launcherKeyHint,
    );
  });

  test("both hints describe the tab for assistive technology, in both languages", () => {
    renderApp(false);
    const ids = (tabButton().getAttribute("aria-describedby") ?? "").split(" ");
    const texts = ids.map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual([
      MESSAGES.en.launcherHint,
      "Alt plus Up or Down arrow to move",
    ]);
    expect(MESSAGES.fr.launcherKeyHintSpoken).toBe(
      "Alt plus flèche haut ou bas pour déplacer",
    );
    expect(MESSAGES.en.launcherKeyHint).toBe("Alt+↑/↓ to move");
    expect(MESSAGES.fr.launcherKeyHint).toBe("Alt+↑/↓ pour déplacer");
  });
});

describe("the launcher's CSS", () => {
  const css = readFileSync(new URL("../../base.css", import.meta.url), "utf8");

  test("hides the tooltip while dragging, while expanded and on touch screens", () => {
    expect(css).toMatch(/\[data-dragging\] \.pulsarix-tab-tip/);
    expect(css).toMatch(/\[aria-expanded="true"\] \.pulsarix-tab-tip/);
    expect(css).toMatch(/@media \(hover: none\)/);
  });

  test("keeps 44 px on screen at rest, a two-tone focus ring and the inverse tooltip", () => {
    // 50 px wide, 6 px peek translate: 44 px stay visible.
    expect(css).toMatch(/\.pulsarix-tab-button \{[^}]*width: 50px/);
    expect(css).toMatch(/translateX\(calc\(var\(--dir\) \* 6px\)\)/);
    expect(css).toMatch(
      /:focus-visible \{\s*outline: 2px solid transparent;\s*box-shadow:\s*0 0 0 2px var\(--background\),\s*0 0 0 5px var\(--foreground\)/,
    );
    expect(css).toMatch(/background: var\(--inverse-surface\)/);
    expect(css).toMatch(/color: var\(--inverse-foreground\)/);
  });

  test("the dark tooltip wears material's opaque tooltip tokens, and nothing uses --destructive", () => {
    expect(css).toMatch(
      /:host\(\[data-resolved-theme="dark"\]\) \.pulsarix-tab-tip \{\s*background: var\(--tooltip\);\s*color: var\(--tooltip-foreground\);/,
    );
    expect(css).not.toMatch(/var\(--destructive/);
    expect(css).not.toMatch(/pulsarix-tab-count/);
  });

  test("respects reduced motion and uses no rem", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(/[0-9.]rem\b/.test(css)).toBe(false);
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

/** The unread bubble of the library's CountBadge, on the tab. */
const badge = () =>
  document.querySelector<HTMLElement>(
    '[data-slot="count-badge"] > [aria-hidden="true"]:not(svg)',
  );

describe("the launcher for an identified reporter", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const quiet = () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: { widgetConfig: null } }), {
        status: 200,
      })) as unknown as typeof fetch;
  };

  test("opens a menu with the two views", async () => {
    quiet();
    const user = userEvent.setup();
    renderApp(false, { identity: "tok" });
    await user.click(tabButton());
    expect(
      (await screen.findByRole("menuitem", { name: MESSAGES.en.title })) !==
        null,
    ).toBe(true);
    expect(
      screen.getByRole("menuitem", { name: MESSAGES.en.myRequests }) !== null,
    ).toBe(true);
    expect(tabButton().getAttribute("aria-expanded")).toBe("true");
  });

  test("the unread count is on the tab at rest, then only on My requests while the menu is open", async () => {
    const user = userEvent.setup();
    render(
      <Launcher
        messages={MESSAGES.en}
        open={false}
        unread={3}
        identified
        fabRef={createRef<HTMLButtonElement>()}
        onReport={() => {}}
        onRequests={() => {}}
      />,
    );
    expect(badge()?.textContent).toBe("3");
    await user.click(tabButton());
    await screen.findByRole("menu");
    expect(badge()).toBeNull();
    const item = screen.getByRole("menuitem", {
      name: new RegExp(MESSAGES.en.myRequests),
    });
    expect(item.querySelector('[data-slot="badge"]')?.textContent).toBe("3");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(badge()?.textContent).toBe("3");
  });

  test("Escape closes the menu and focus goes back to the tab", async () => {
    quiet();
    const user = userEvent.setup();
    renderApp(false, { identity: "tok" });
    await user.click(tabButton());
    await screen.findByRole("menu");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(tabButton());
  });

  test("a drag never opens the menu", () => {
    quiet();
    renderApp(false, { identity: "tok" });
    const button = tabButton();
    fireEvent.pointerDown(button, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(button, { clientY: 350, pointerId: 1 });
    fireEvent.pointerUp(button, { pointerId: 1 });
    fireEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("the unread count in the tab's name", () => {
  const launcher = (identified: boolean, locale: "en" | "fr", unread = 2) => (
    <Launcher
      messages={MESSAGES[locale]}
      open={false}
      unread={unread}
      identified={identified}
      fabRef={createRef<HTMLButtonElement>()}
      onReport={() => {}}
      onRequests={() => {}}
    />
  );

  test("is in the accessible name, anonymous or identified, in both languages", () => {
    const names = {
      false: {
        en: "Report a problem, 2 unread requests",
        fr: "Signaler un problème, 2 demandes non lues",
      },
      true: {
        en: "Feedback and requests, 2 unread requests",
        fr: "Retours et demandes, 2 demandes non lues",
      },
    };
    for (const identified of [false, true]) {
      for (const locale of ["en", "fr"] as const) {
        const { unmount } = render(launcher(identified, locale));
        expect(
          screen.getByRole("button", {
            name: names[String(identified) as "true" | "false"][locale],
          }),
        ).toBeTruthy();
        unmount();
      }
    }
  });

  test("one unread request is singular, none leaves the plain label", () => {
    const { unmount } = render(launcher(false, "en", 1));
    expect(
      screen.getByRole("button", {
        name: "Report a problem, 1 unread request",
      }),
    ).toBeTruthy();
    unmount();
    render(launcher(false, "en", 0));
    expect(
      screen.getByRole("button", { name: "Report a problem" }),
    ).toBeTruthy();
  });
});
