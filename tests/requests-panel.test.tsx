import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/app";
import { MESSAGES } from "../src/messages";

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
  onError: () => {},
});

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("My requests", () => {
  test("no identity: no tabs and no list call", async () => {
    answer([]);
    render(<App {...props(null)} open />);
    await screen.findByRole("dialog");
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(calls.some((c) => c.id === "myRequests")).toBe(false);
  });

  test("an identified reporter gets tabs, the list with counts, and the launcher badge", async () => {
    answer([row("r1", "Pay button broken", 2)]);
    render(<App {...props("a.b")} open={false} />);
    await waitFor(() =>
      expect(screen.getByText(/2 unread replies/)).toBeTruthy(),
    );
    expect(calls[0]?.identity).toBe("a.b");
  });

  test("the My requests tab lists the rows and refetches on a filter change", async () => {
    answer([row("r1", "Pay button broken", 2)]);
    render(<App {...props("a.b")} open />);
    await userEvent.click(
      await screen.findByRole("tab", { name: /My requests/ }),
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
      await screen.findByRole("tab", { name: /My requests/ }),
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
      await screen.findByRole("tab", { name: /My requests/ }),
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
      await screen.findByRole("tab", { name: /My requests/ }),
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
      await screen.findByRole("tab", { name: /My requests/ }),
    );
    await screen.findByText(/Your session expired/);
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull();
  });
});
