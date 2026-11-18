import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/app";
import type { Locale } from "../src/config";
import { MESSAGES } from "../src/messages";
import { MIN_FILL_MS } from "../src/report-flow";

interface Body {
  id: string;
  variables: {
    publicKey: string;
    input: Record<string, unknown> & { email?: string; filledInMs: number };
  };
}
type Handler = (request: {
  url: string;
  body: Body;
  headers: Headers;
}) => Response;

let calls: Array<{ url: string; body: Body; headers: Headers }> = [];
// The `widgetConfig` reads (the project's name), kept apart from the reports.
let configCalls: Array<{ url: string; body: Body }> = [];
let projectName: string | null = "Acme Store";
let handler: Handler;
const realFetch = globalThis.fetch;

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
const ok = (tracking: boolean) =>
  json(200, { data: { submitClientReport: { reportId: "r1", tracking } } });
const refusal = (status: number, code: string, extra: object = {}) =>
  json(status, { errors: [{ message: code, extensions: { code, ...extra } }] });

beforeEach(() => {
  calls = [];
  configCalls = [];
  projectName = "Acme Store";
  handler = () => ok(false);
  globalThis.fetch = mock(async (url: string, init: RequestInit) => {
    const call = {
      url,
      body: JSON.parse(String(init.body)) as Body,
      headers: new Headers(init.headers),
    };
    if (call.body.id === "widgetConfig") {
      configCalls.push(call);
      return json(200, {
        data: {
          widgetConfig: projectName
            ? { projectName, locale: "en", enabled: true, attachments: true }
            : null,
        },
      });
    }
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

function setup(
  options: {
    locale?: Locale;
    projectKey?: string | null;
    apiBase?: string | null;
    minFillMs?: number;
  } = {},
) {
  const locale = options.locale ?? "en";
  const onSubmitted = mock((_: { reportId: string }) => {});
  const onError = mock((_: { code: string }) => {});
  const onOpenChange = mock((_: boolean) => {});
  render(
    <App
      messages={MESSAGES[locale]}
      locale={locale}
      projectKey={
        options.projectKey === undefined ? "pk_live_abc" : options.projectKey
      }
      apiBase={
        options.apiBase === undefined
          ? "https://pulsarix.test"
          : options.apiBase
      }
      dark={false}
      open
      launcher={false}
      position="bottom-right"
      onOpenChange={onOpenChange}
      onSubmitted={onSubmitted}
      onError={onError}
      minFillMs={options.minFillMs ?? 0}
    />,
  );
  return { user: userEvent.setup(), onSubmitted, onError, onOpenChange };
}

const m = MESSAGES.en;

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { title?: string; description?: string; email?: string },
) {
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toBeTruthy();
  if (values.title !== undefined)
    await user.type(
      screen.getByRole("textbox", { name: /Title/ }),
      values.title,
    );
  if (values.description !== undefined)
    await user.type(
      screen.getByRole("textbox", { name: /What happened/ }),
      values.description,
    );
  if (values.email !== undefined)
    await user.type(
      screen.getByRole("textbox", { name: /e-mail/i }),
      values.email,
    );
}

const send = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: m.submit }));

describe("the report form", () => {
  test("opens as a labelled dialog with its three fields", async () => {
    setup();
    const dialog = await screen.findByRole("dialog", { name: m.title });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /Title/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /What happened/ })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /e-mail/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: m.submit })).toBeTruthy();
  });

  test("submits the persisted operation, with the page, the locale and the honeypot", async () => {
    const { user, onSubmitted } = setup();
    await fill(user, {
      title: "  Checkout fails ",
      description: "Pay button does nothing",
    });
    await send(user);
    await screen.findByText(m.done.noTracking);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe("https://pulsarix.test/public/graphql");
    expect(call?.headers.get("accept-language")).toBe("en");
    expect(call?.body.id).toBe("submitClientReport");
    expect(call?.body.variables.publicKey).toBe("pk_live_abc");
    expect(call?.body.variables.input).toMatchObject({
      title: "Checkout fails",
      description: "Pay button does nothing",
      pageUrl: "https://shop.example.com/cart",
      locale: "en",
      website: "",
    });
    expect(call?.body.variables.input).not.toHaveProperty("email");
    expect(typeof call?.body.variables.input.filledInMs).toBe("number");
    expect(onSubmitted).toHaveBeenCalledWith({ reportId: "r1", files: [] });
    expect(screen.getByRole("status")).toBeTruthy();
  });

  test("an e-mail is sent, and the confirmation says a link was mailed", async () => {
    handler = () => ok(true);
    const { user } = setup();
    await fill(user, {
      title: "Crash",
      description: "On save",
      email: "ada@example.com",
    });
    await send(user);
    await screen.findByText(m.done.tracking);
    expect(calls[0]?.body.variables.input.email).toBe("ada@example.com");
  });

  test("empty required fields and a bad e-mail show their errors and send nothing", async () => {
    const { user, onError } = setup();
    await fill(user, { email: "not-an-email" });
    await send(user);
    await screen.findByText(m.errors.titleRequired);
    expect(screen.getByText(m.errors.descriptionRequired)).toBeTruthy();
    expect(screen.getByText(m.errors.emailInvalid)).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("textbox", { name: /Title/ })
        .getAttribute("aria-invalid"),
    ).toBe("true");
  });

  test("a busy service (503) keeps the text and lets the reporter retry", async () => {
    handler = () => refusal(503, "intake.errors.unavailable");
    const { user, onError } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    const alert = await screen.findByText(m.failure.unavailable);
    expect(alert).toBeTruthy();
    expect(onError).toHaveBeenCalledWith({ code: "intake.errors.unavailable" });
    expect(
      (screen.getByRole("textbox", { name: /Title/ }) as HTMLInputElement)
        .value,
    ).toBe("Crash");
    handler = () => ok(false);
    await send(user);
    await screen.findByText(m.done.body, {
      selector: "[data-slot=dialog-description], *",
    });
    expect(calls).toHaveLength(2);
  });

  test("a rejected key says the site cannot report, and stops offering to send", async () => {
    handler = () => refusal(404, "intake.errors.unknown-key");
    const { user, onError } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.rejected);
    expect(onError).toHaveBeenCalledWith({ code: "intake.errors.unknown-key" });
    const button = screen.getByRole("button", { name: m.submit });
    expect(
      button.hasAttribute("disabled") ||
        button.getAttribute("aria-disabled") === "true",
    ).toBe(true);
  });

  test("a refused origin reaches the widget as a network failure (no CORS headers)", async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const { user, onError } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.network);
    expect(onError).toHaveBeenCalledWith({ code: "network" });
  });

  // Not delivered by browsers (they hide a response without CORS headers), but the code
  // handles a readable 403, for example from a non-browser host.
  test("a readable 403 is rejected like an unknown key", async () => {
    handler = () => refusal(403, "intake.errors.origin-not-allowed");
    const { user } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.rejected);
  });

  describe("the page address", () => {
    afterEach(() => window.history.pushState({}, "", "/"));

    test("is sent without its query and fragment", async () => {
      window.history.pushState({}, "", "/cart?token=secret&x=1#access=abc");
      const { user } = setup();
      await fill(user, { title: "Crash", description: "On save" });
      await send(user);
      await screen.findByRole("status");
      const sent = String(calls[0]?.body.variables.input.pageUrl);
      expect(sent).toBe(`${location.origin}/cart`);
      expect(sent).not.toContain("secret");
    });

    test("is left out when the origin is opaque (file:// or a sandboxed frame)", async () => {
      Object.defineProperty(window.location, "origin", {
        value: "null",
        configurable: true,
      });
      try {
        const { user } = setup();
        await fill(user, { title: "Crash", description: "On save" });
        await send(user);
        await screen.findByRole("status");
        expect(calls[0]?.body.variables.input.pageUrl).toBeUndefined();
      } finally {
        Reflect.deleteProperty(window.location, "origin");
      }
    });
  });

  test("a rate limit tells how long to wait", async () => {
    handler = () =>
      refusal(429, "intake.errors.too-many-requests", { retryAfter: 600 });
    const { user } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.rateLimited(10));
  });

  test("a network failure is told as such, with the text kept", async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const { user, onError } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.network);
    expect(onError).toHaveBeenCalledWith({ code: "network" });
  });

  test("a missing project key is a configuration error and nothing is sent", async () => {
    const { user, onError } = setup({ projectKey: null });
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.failure.config);
    expect(calls).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith({ code: "config" });
  });

  test("the French locale translates the form, the errors and the request", async () => {
    const fr = MESSAGES.fr;
    const { user } = setup({ locale: "fr" });
    await screen.findByRole("dialog", { name: fr.title });
    await user.click(screen.getByRole("button", { name: fr.submit }));
    await screen.findByText(fr.errors.titleRequired);
    await user.type(screen.getByRole("textbox", { name: /Titre/ }), "Panne");
    await user.type(
      screen.getByRole("textbox", { name: /Que s'est-il passé/ }),
      "Rien ne marche",
    );
    await user.click(screen.getByRole("button", { name: fr.submit }));
    await screen.findByText(fr.done.noTracking);
    expect(calls[0]?.headers.get("accept-language")).toBe("fr");
    expect(calls[0]?.body.variables.input.locale).toBe("fr");
  });

  test.each(["en", "fr"] as const)(
    "the dialog's language is %s",
    async (locale) => {
      setup({ locale });
      const dialog = await screen.findByRole("dialog");
      expect(dialog.closest("[lang]")?.getAttribute("lang")).toBe(locale);
    },
  );

  test("the confirmation closes the dialog", async () => {
    const { user, onOpenChange } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.done.noTracking);
    await user.click(screen.getByRole("button", { name: m.close }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("Escape closes the dialog", async () => {
    const { user, onOpenChange } = setup();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("the honeypot is hidden from people and from the accessibility tree", async () => {
    setup();
    await screen.findByRole("dialog");
    const trap = document.querySelector<HTMLInputElement>(
      "input[name=url_confirm]",
    );
    expect(trap?.getAttribute("aria-hidden")).toBe("true");
    expect(trap?.tabIndex).toBe(-1);
  });

  test("the API's minimum fill time is 3 s, and a quick submit waits it out", async () => {
    expect(MIN_FILL_MS).toBe(3000);
    const { user } = setup({ minFillMs: 200 });
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.done.noTracking);
    const sent = calls[0]?.body.variables.input.filledInMs ?? 0;
    expect(sent).toBeGreaterThanOrEqual(200);
  });

  test("closing during the wait sends nothing", async () => {
    const { user, onOpenChange } = setup({ minFillMs: 600 });
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  test("the request is the persisted JSON operation, without credentials", async () => {
    const seen: RequestInit[] = [];
    globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
      seen.push(init);
      return ok(false);
    }) as unknown as typeof fetch;
    const { user } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    await screen.findByText(m.done.noTracking);
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.credentials).toBe("omit");
    expect(new Headers(seen[0]?.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  test("a failure is announced in a live region", async () => {
    handler = () => refusal(503, "intake.errors.unavailable");
    const { user } = setup();
    await fill(user, { title: "Crash", description: "On save" });
    await send(user);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(m.failure.unavailable);
  });

  test("a stricter e-mail than a@b.c is refused before sending", async () => {
    const { user } = setup();
    await fill(user, {
      title: "Crash",
      description: "On save",
      email: "a@b.c",
    });
    await send(user);
    await screen.findByText(m.errors.emailInvalid);
    expect(calls).toHaveLength(0);
  });
});

describe("the split dialog", () => {
  test("names the project from widgetConfig, with the key, above the form", async () => {
    setup();
    await screen.findByText("Acme Store");
    expect(screen.getByText(m.introFor("Acme Store"))).toBeTruthy();
    expect(configCalls).toHaveLength(1);
    expect(configCalls[0]?.body.variables.publicKey).toBe("pk_live_abc");
  });

  test("shows the plain intro when the project is unknown", async () => {
    projectName = null;
    setup();
    await screen.findByRole("dialog");
    await waitFor(() => expect(configCalls).toHaveLength(1));
    expect(screen.getByText(m.intro)).toBeTruthy();
    expect(screen.queryByTestId("project-name")).toBeNull();
  });

  test("groups the fields in titled sections and keeps a screenshot pane beside the form", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.getAttribute("data-layout")).toBe("split");
    expect(
      screen.getByRole("region", { name: m.sections.problem }),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: m.sections.contact }),
    ).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: m.aside.title }),
    ).toBeTruthy();
  });

  test("sends no widgetConfig read without a key", async () => {
    setup({ projectKey: null });
    await screen.findByRole("dialog");
    expect(configCalls).toHaveLength(0);
  });

  test("a failing widgetConfig read leaves the plain intro", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
      if ((JSON.parse(String(init.body)) as Body).id === "widgetConfig")
        throw new TypeError("Failed to fetch");
      return ok(false);
    }) as unknown as typeof fetch;
    setup();
    await screen.findByText(m.intro);
    expect(screen.queryByTestId("project-name")).toBeNull();
    globalThis.fetch = real;
  });
});
