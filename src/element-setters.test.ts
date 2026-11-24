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
import userEvent from "@testing-library/user-event";
import { MESSAGES } from "./core/messages";
import { mount, type WidgetHandle } from "./mount";

// The spam guard holds a submit for 3 s after the dialog opens.
setDefaultTimeout(15_000);

let handle: WidgetHandle | null = null;
const realFetch = globalThis.fetch;
let submitDelay = 0;
let submitStarted = 0;
let withAttachments = false;
let submitted: Array<{ metadata?: Array<{ key: string; value: string }> }> = [];

beforeEach(() => {
  submitted = [];
  submitDelay = 0;
  submitStarted = 0;
  withAttachments = false;
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      id: string;
      variables?: { input?: (typeof submitted)[number] };
    };
    if (body.id !== "widgetConfig" && body.variables?.input)
      submitted.push(body.variables.input);
    if (body.id !== "widgetConfig") submitStarted += 1;
    if (body.id !== "widgetConfig" && submitDelay)
      await new Promise((resolve) => setTimeout(resolve, submitDelay));
    const data =
      body.id === "widgetConfig"
        ? {
            widgetConfig: withAttachments
              ? { projectName: "Acme", enabled: true, attachments: true }
              : null,
          }
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

const shadowOf = (h: WidgetHandle) => h.element.shadowRoot as ShadowRoot;
const field = <T extends Element>(h: WidgetHandle, selector: string) =>
  shadowOf(h).querySelector(selector) as T;

async function openWithDraft(options: Parameters<typeof mount>[0]) {
  handle = mount({
    apiBase: "https://pulsarix.test",
    launcher: false,
    ...options,
  });
  handle.open();
  await waitFor(() =>
    expect(
      shadowOf(handle as WidgetHandle).querySelector("form"),
    ).not.toBeNull(),
  );
  fireEvent.change(field(handle, 'input[name="title"]'), {
    target: { value: "Checkout" },
  });
  fireEvent.change(field(handle, 'textarea[name="description"]'), {
    target: { value: "Pay does nothing" },
  });
  return handle;
}

const typed = (h: WidgetHandle) => ({
  title: field<HTMLInputElement>(h, 'input[name="title"]').value,
  description: field<HTMLTextAreaElement>(h, 'textarea[name="description"]')
    .value,
});
const DRAFT = { title: "Checkout", description: "Pay does nothing" };

describe("run-time setters", () => {
  test("setTheme switches the mode live: light, dark, and auto follows the OS", () => {
    handle = mount({
      projectKey: "pk_live_abc",
      launcher: false,
      theme: "light",
    });
    const mode = () => handle?.element.getAttribute("data-resolved-theme");
    expect(mode()).toBe("light");
    handle.setTheme("dark");
    expect(mode()).toBe("dark");
    handle.setTheme("light");
    expect(mode()).toBe("light");
    // The test OS has no dark preference: auto resolves to light, whatever the host page does.
    document.documentElement.classList.add("dark");
    handle.setTheme("auto");
    expect(mode()).toBe("light");
    document.documentElement.classList.remove("dark");
    expect(handle.element.config.theme).toBe("auto");
  });

  test("with a host mode inherited, an explicit setTheme wins and auto hands it back", () => {
    const html = document.documentElement;
    html.classList.add("dark");
    html.style.setProperty("--primary", "#00aa00");
    handle = mount({ projectKey: "pk_live_abc", launcher: false });
    const mode = () => handle?.element.getAttribute("data-resolved-theme");
    expect(mode()).toBe("dark");
    handle.setTheme("light");
    expect(mode()).toBe("light");
    handle.setTheme("auto");
    expect(mode()).toBe("dark");
    html.classList.remove("dark");
    html.style.removeProperty("--primary");
  });

  test("a theme given at mount is honoured, and an unknown value is ignored", () => {
    handle = mount({ projectKey: "pk_live_abc", theme: "dark" });
    expect(handle.element.getAttribute("data-resolved-theme")).toBe("dark");
    handle.setTheme("sepia" as never);
    expect(handle.element.config.theme).toBe("dark");
  });

  test("setTheme re-renders the root's dark class without a new element", async () => {
    handle = await openWithDraft({ projectKey: "pk_live_abc", theme: "light" });
    const root = () =>
      shadowOf(handle as WidgetHandle).querySelector(".pulsarix-root");
    expect(root()?.classList.contains("dark")).toBe(false);
    handle.setTheme("dark");
    await waitFor(() => expect(root()?.classList.contains("dark")).toBe(true));
  });

  test("the draft survives setTheme", async () => {
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    h.setTheme("dark");
    await waitFor(() =>
      expect(shadowOf(h).querySelector(".pulsarix-root.dark")).not.toBeNull(),
    );
    expect(h.element.isOpen).toBe(true);
    expect(typed(h)).toEqual(DRAFT);
  });

  test("setLocale re-renders the strings and keeps the dialog and the draft", async () => {
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    expect(shadowOf(h).textContent).toContain("Report a problem");
    const form = field<HTMLFormElement>(h, "form");
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Signaler un problème"),
    );
    expect(
      shadowOf(h).querySelector(".pulsarix-root")?.getAttribute("lang"),
    ).toBe("fr");
    expect(h.element.isOpen).toBe(true);
    // Not remounted: the same form node, with the typed title still in it.
    expect(form.isConnected).toBe(true);
    expect(typed(h)).toEqual(DRAFT);
    h.setLocale("en");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Report a problem"),
    );
    expect(typed(h)).toEqual(DRAFT);
  });

  test("setLocale ignores an unsupported locale", () => {
    handle = mount({ projectKey: "pk_live_abc", locale: "fr" });
    handle.setLocale("de" as never);
    expect(handle.element.config.locale).toBe("fr");
  });

  test("setMetadata replaces the metadata, null clears it, the draft survives", async () => {
    const h = await openWithDraft({
      projectKey: "pk_live_abc",
      metadata: { org: "a" },
    });
    expect(h.element.config.metadata).toEqual([{ key: "org", value: "a" }]);
    h.setMetadata({ org: "b", seats: 3 });
    expect(h.element.config.metadata).toEqual([
      { key: "org", value: "b" },
      { key: "seats", value: "3" },
    ]);
    expect(typed(h)).toEqual(DRAFT);
    h.setMetadata(null);
    expect(h.element.config.metadata).toEqual([]);
    expect(h.element.hasAttribute("metadata")).toBe(false);
    h.setMetadata({ org: "c" });
    expect(typed(h)).toEqual(DRAFT);
  });

  test("the next report carries the latest metadata, set after the dialog opened", async () => {
    const events: CustomEvent[] = [];
    const h = await openWithDraft({
      projectKey: "pk_live_abc",
      metadata: { org: "a" },
    });
    h.element.addEventListener("pulsarix:submit", (e) =>
      events.push(e as CustomEvent),
    );
    h.setMetadata({ org: "b" });
    // React renders the new props on its next tick, as it does for a real click.
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.submit(field(h, "form"));
    await waitFor(() => expect(events).toHaveLength(1), { timeout: 8_000 });
    expect(submitted[0]?.metadata).toEqual([{ key: "org", value: "b" }]);
  });

  test("the draft survives setLocale, setTheme and setMetadata together", async () => {
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    h.setLocale("fr");
    h.setTheme("dark");
    h.setMetadata({ org: "z" });
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Signaler un problème"),
    );
    expect(h.element.isOpen).toBe(true);
    expect(typed(h)).toEqual(DRAFT);
  });

  test("type and impact are kept by setLocale", async () => {
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    const chip = (name: string) =>
      [...shadowOf(h).querySelectorAll("[role=radio],button")].find((el) =>
        el.textContent?.trim().startsWith(name),
      ) as HTMLElement;
    fireEvent.click(chip("Bug"));
    fireEvent.click(chip("Annoying"));
    const pressed = (el: HTMLElement) =>
      el.getAttribute("aria-checked") ?? el.getAttribute("aria-pressed");
    expect(pressed(chip("Bug"))).toBe("true");
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Signaler un problème"),
    );
    const fr = MESSAGES.fr.choices;
    expect(pressed(chip(fr.type.bug))).toBe("true");
    expect(pressed(chip(fr.impact.annoying))).toBe("true");
  });

  test("setLocale keeps the files already attached and the form mounted", async () => {
    withAttachments = true;
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    const user = userEvent.setup({ applyAccept: false });
    await waitFor(() => expect(field(h, 'input[type="file"]')).not.toBeNull());
    await user.upload(
      field<HTMLInputElement>(h, 'input[type="file"]'),
      new File([new Uint8Array(100)], "log.txt", { type: "text/plain" }),
    );
    await waitFor(() => expect(shadowOf(h).textContent).toContain("log.txt"));
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Signaler un problème"),
    );
    expect(shadowOf(h).textContent).toContain("log.txt");
    expect(typed(h)).toEqual(DRAFT);
  });

  test("setLocale while a report is on its way keeps the form; the strings still follow", async () => {
    const events: CustomEvent[] = [];
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    h.element.addEventListener("pulsarix:submit", (e) =>
      events.push(e as CustomEvent),
    );
    submitDelay = 2_000;
    const form = field<HTMLFormElement>(h, "form");
    fireEvent.submit(form);
    await waitFor(() => expect(submitStarted).toBe(1), { timeout: 8_000 });
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain("Signaler un problème"),
    );
    // Not re-keyed: the same form is still there, and the submit goes on.
    expect(form.isConnected).toBe(true);
    await waitFor(() => expect(events).toHaveLength(1), { timeout: 8_000 });
    expect(events).toHaveLength(1);
  });

  test("setLocale on the confirmation keeps it", async () => {
    const h = await openWithDraft({ projectKey: "pk_live_abc" });
    fireEvent.submit(field(h, "form"));
    await waitFor(
      () => expect(shadowOf(h).textContent).toContain(MESSAGES.en.done.title),
      { timeout: 8_000 },
    );
    const confirmation = [...shadowOf(h).querySelectorAll("[tabindex]")].find(
      (el) => el.textContent?.includes(MESSAGES.en.done.title),
    );
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain(MESSAGES.fr.done.title),
    );
    expect(confirmation?.isConnected).toBe(true);
    expect(h.element.isOpen).toBe(true);
  });

  test("the requests view stays open through setLocale", async () => {
    handle = mount({
      apiBase: "https://pulsarix.test",
      projectKey: "pk_live_abc",
      identity: "a.b",
    });
    const h = handle as WidgetHandle;
    const user = userEvent.setup();
    await waitFor(() =>
      expect(shadowOf(h).querySelector("button[aria-label]")).not.toBeNull(),
    );
    await user.click(
      shadowOf(h).querySelector("button[aria-label]") as HTMLElement,
    );
    await waitFor(() =>
      expect(shadowOf(h).querySelector('[role="menuitem"]')).not.toBeNull(),
    );
    const toRequests = [
      ...shadowOf(h).querySelectorAll('[role="menuitem"]'),
    ].find((el) =>
      el.textContent?.includes(MESSAGES.en.myRequests),
    ) as HTMLElement;
    await user.click(toRequests);
    await waitFor(() =>
      expect(
        shadowOf(h).querySelector('[role="dialog"]')?.textContent,
      ).toContain(MESSAGES.en.myRequests),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dialog = shadowOf(h).querySelector('[role="dialog"]');
    h.setLocale("fr");
    await waitFor(() =>
      expect(shadowOf(h).textContent).toContain(MESSAGES.fr.myRequests),
    );
    expect(dialog?.isConnected).toBe(true);
    expect(dialog?.textContent).not.toContain(MESSAGES.fr.intro);
  });

  test("a theme attribute written after setTheme gives the mode back to the host", () => {
    const html = document.documentElement;
    html.classList.add("light");
    html.style.setProperty("--primary", "#00aa00");
    handle = mount({ projectKey: "pk_live_abc", launcher: false });
    const mode = () => handle?.element.getAttribute("data-resolved-theme");
    handle.setTheme("dark");
    expect(mode()).toBe("dark");
    handle.element.setAttribute("theme", "auto");
    expect(mode()).toBe("light");
    html.classList.remove("light");
    html.style.removeProperty("--primary");
  });
});
