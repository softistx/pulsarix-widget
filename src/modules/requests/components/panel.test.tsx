import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../../app";
import { MESSAGES } from "../../../core/messages";

const originalFetch = globalThis.fetch;
let calls: Array<{
  id: string;
  variables: Record<string, unknown>;
  identity: string | null;
}>;

const row = (id: string, title: string, unread = 0) => ({
  id,
  title,
  publicState: "received",
  createdAt: "2026-11-12T10:00:00Z",
  type: null,
  impact: null,
  unread,
});

function answer(nodes: unknown[], extra: object = {}, status = 200) {
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({
      id: body.id,
      variables: body.variables,
      identity:
        (init.headers as Record<string, string>)["x-pulsarix-identity"] ?? null,
    });
    if (body.id === "widgetConfig") {
      return new Response(
        JSON.stringify({
          data: { widgetConfig: { name: "Shop", attachments: true } },
        }),
      );
    }
    if (status !== 200) {
      return new Response(
        JSON.stringify({
          errors: [{ extensions: { code: "intake.errors.identity-invalid" } }],
        }),
        { status },
      );
    }
    return new Response(
      JSON.stringify({
        data: {
          myRequests: {
            nodes,
            counts: {
              open: nodes.length,
              resolved: 2,
              declined: 0,
              all: nodes.length + 2,
            },
            unread: 2,
            emailsOn: false,
            endCursor: null,
            hasNextPage: false,
            ...extra,
          },
        },
      }),
    );
  }) as unknown as typeof fetch;
}

let errors: { code: string }[] = [];
const props = (identity: string | null) => ({
  messages: MESSAGES.en,
  locale: "en" as const,
  projectKey: "pk_live_abc",
  apiBase: "https://pulsarix.test",
  dark: false,
  launcher: true,
  position: "bottom-right" as const,
  identity,
  onOpenChange: () => {},
  onSubmitted: () => {},
  onError: (d: { code: string }) => errors.push(d),
});

beforeEach(() => {
  calls = [];
  errors = [];
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("My requests", () => {
  test("no identity: no way to My requests and no list call", async () => {
    answer([]);
    render(<App {...props(null)} open />);
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /My requests/ })).toBeNull();
    expect(calls.some((c) => c.id === "myRequests")).toBe(false);
  });

  test("an identified reporter gets the way to the list with counts, and the launcher badge", async () => {
    answer([row("r1", "Pay button broken", 2)]);
    render(<App {...props("a.b")} open={false} />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /2 unread replies/ }),
      ).toBeTruthy(),
    );
    expect(calls[0]?.identity).toBe("a.b");
  });

  test("My requests lists the rows and refetches on a filter change", async () => {
    answer([row("r1", "Pay button broken", 2)]);
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await screen.findByText("Pay button broken");
    expect(calls.at(-1)?.variables.filter).toBe("OPEN");
    await userEvent.click(screen.getByRole("radio", { name: /^Resolved/ }));
    await waitFor(() =>
      expect(calls.at(-1)?.variables.filter).toBe("RESOLVED"),
    );
  });

  test("an empty list shows the empty state with a way to a new request", async () => {
    answer([], {
      counts: { open: 0, resolved: 0, declined: 0, all: 0 },
      unread: 0,
    });
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /New request/ }),
    );
    await screen.findByRole("textbox", { name: /Title/ });
  });

  test("a filter with no request shows the search empty state, not the first-use one", async () => {
    answer([], { counts: { open: 0, resolved: 0, declined: 0, all: 3 } });
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await screen.findByText("No open requests.");
    expect(screen.queryByText("No requests yet")).toBeNull();
    expect(screen.queryByRole("button", { name: /New request/ })).toBeNull();
  });

  test("while the list loads, a busy status with a skeleton stands in", async () => {
    answer([row("r1", "Pay button broken")]);
    const fetchNow = globalThis.fetch;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
      if (JSON.parse(String(init.body)).id === "myRequests") await held;
      return fetchNow(url as string, init);
    }) as unknown as typeof fetch;
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    const busy = await screen.findByText("Loading your requests...");
    expect(busy.closest('[role="status"]')?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getAllByRole("status").some((s) => s.contains(busy))).toBe(
      true,
    );
    release();
    await screen.findByText("Pay button broken");
    expect(screen.queryByText("Loading your requests...")).toBeNull();
  });

  test("a bad identity shows an alert without a retry", async () => {
    answer([], {}, 401);
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await screen.findByText(/Your session expired/);
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
  });

  test("a refused identity tells the page", async () => {
    answer([], {}, 401);
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await screen.findByText(/Your session expired/);
    expect(errors).toEqual([{ code: "intake.errors.identity-invalid" }]);
  });

  test("a row is named by its title, state and new replies", async () => {
    answer([row("r1", "Billing question", 3)]);
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    const button = await screen.findByRole("button", {
      name: /Open request: Billing question/,
    });
    expect(button.getAttribute("aria-label")).toMatch(/Received/);
    expect(button.getAttribute("aria-label")).toMatch(/3/);
  });

  test("My requests is its own view, with its own title and no tabs", async () => {
    answer([]);
    render(<App {...props("a.b")} open />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "My requests" }),
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole("heading", { name: "Report a problem" }),
    ).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  test("the unread count on the way to the list is announced once", async () => {
    answer([row("r1", "Billing question", 2)]);
    const view = render(<App {...props("a.b")} open={false} />);
    await screen.findByRole("button", { name: /2 unread replies/ });
    // The count is read while the dialog is closed, then carried into it.
    view.rerender(<App {...props("a.b")} open />);
    const button = await screen.findByRole("button", { name: /My requests/ });
    await waitFor(() => expect(button.textContent).toMatch(/2/));
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe("2");
    expect(button.textContent?.match(/2/g)).toHaveLength(2);
  });

  test("Show more reads the next page with its cursor and appends it", async () => {
    const pages: Array<string | null> = [];
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.id === "widgetConfig")
        return new Response(
          JSON.stringify({
            data: { widgetConfig: { name: "Shop", attachments: true } },
          }),
        );
      const after = (body.variables.after as string | null) ?? null;
      pages.push(after);
      const first = after === null;
      return new Response(
        JSON.stringify({
          data: {
            myRequests: {
              nodes: first
                ? [row("r1", "First page")]
                : [row("r2", "Second page")],
              counts: { open: 2, resolved: 0, declined: 0, all: 2 },
              unread: 0,
              emailsOn: true,
              endCursor: first ? "c1" : null,
              hasNextPage: first,
            },
          },
        }),
      );
    }) as unknown as typeof fetch;
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("button", { name: /My requests/ }),
    );
    await screen.findByRole("button", { name: /First page/ });
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    await screen.findByRole("button", { name: /Second page/ });
    expect(screen.getByRole("button", { name: /First page/ })).toBeTruthy();
    expect(pages).toEqual([null, "c1"]);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
