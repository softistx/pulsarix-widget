import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/app";
import { MESSAGES } from "../src/messages";

const originalFetch = globalThis.fetch;

interface Stub {
  ops: { id: string; variables: Record<string, unknown> }[];
  /** Answers `setRequestEmails`; a promise to hold it, a number to fail with that status. */
  emails: () => Promise<number | null> | number | null;
  erase: () => number | { status: number };
}

function stub(over: Partial<Stub> = {}): Stub {
  const state: Stub = {
    ops: [],
    emails: () => null,
    erase: () => 2,
    ...over,
  };
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    state.ops.push({ id: body.id, variables: body.variables });
    const fail = (status: number) =>
      new Response(
        JSON.stringify({
          errors: [{ extensions: { code: `intake.errors.http-${status}` } }],
        }),
        { status },
      );
    if (body.id === "widgetConfig")
      return new Response(
        JSON.stringify({
          data: { widgetConfig: { name: "Shop", attachments: true } },
        }),
      );
    if (body.id === "setRequestEmails") {
      const status = await state.emails();
      return status
        ? fail(status)
        : new Response(JSON.stringify({ data: { setRequestEmails: true } }));
    }
    if (body.id === "eraseMyData") {
      const result = state.erase();
      return typeof result === "number"
        ? new Response(
            JSON.stringify({ data: { eraseMyData: { requests: result } } }),
          )
        : fail(result.status);
    }
    return new Response(
      JSON.stringify({
        data: {
          myRequests: {
            nodes: [
              {
                id: "r1",
                title: "Pay button broken",
                publicState: "received",
                createdAt: "2026-11-12T10:00:00Z",
                type: null,
                impact: null,
                unread: 1,
              },
            ],
            counts: { open: 1, resolved: 1, declined: 0, all: 2 },
            unread: 1,
            emailsOn: false,
            endCursor: null,
            hasNextPage: false,
          },
        },
      }),
    );
  }) as unknown as typeof fetch;
  return state;
}

const props = {
  messages: MESSAGES.en,
  locale: "en" as const,
  projectKey: "pk_live_abc",
  apiBase: "https://pulsarix.test",
  dark: false,
  launcher: true,
  position: "bottom-right" as const,
  identity: "a.b",
  onOpenChange: () => {},
  onSubmitted: () => {},
  onError: () => {},
};

async function openList(extra: Partial<Parameters<typeof App>[0]> = {}) {
  render(<App {...props} {...extra} open />);
  await userEvent.click(
    await screen.findByRole("tab", { name: /My requests/ }),
  );
  await screen.findByText("Pay button broken");
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("the e-mail choice", () => {
  test("starts from emailsOn, flips at once and sends the choice", async () => {
    let release: (v: null) => void = () => {};
    const api = stub({
      emails: () => new Promise((resolve) => (release = resolve)),
    });
    await openList();
    const toggle = await screen.findByRole("switch", {
      name: /E-mails about my requests/,
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(toggle);
    // Optimistic: on before the API answered.
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await waitFor(() =>
      expect(
        api.ops.find((o) => o.id === "setRequestEmails")?.variables,
      ).toEqual({ publicKey: "pk_live_abc", on: true }),
    );
    release(null);
    await waitFor(() =>
      expect(toggle.getAttribute("aria-checked")).toBe("true"),
    );
    expect(screen.queryByText(/choice was not saved/)).toBeNull();
  });

  test("a failure rolls the switch back and says so", async () => {
    stub({ emails: () => 429 });
    await openList();
    const toggle = await screen.findByRole("switch", {
      name: /E-mails about my requests/,
    });
    await userEvent.click(toggle);
    await screen.findByText(/choice was not saved/);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});

describe("Delete my data", () => {
  test("Cancel erases nothing", async () => {
    const api = stub();
    await openList();
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my data" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("cannot be undone");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api.ops.some((o) => o.id === "eraseMyData")).toBe(false);
    expect(screen.getByText("Pay button broken")).toBeTruthy();
  });

  test("confirming erases, shows the count, empties the list and tells the host", async () => {
    const api = stub();
    const erased: unknown[] = [];
    const unread: number[] = [];
    await openList({
      onErase: (detail) => erased.push(detail),
      onUnreadChange: (detail) => unread.push(detail.count),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my data" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await screen.findByText("2 requests erased.");
    expect(api.ops.find((o) => o.id === "eraseMyData")?.variables).toEqual({
      publicKey: "pk_live_abc",
    });
    expect(screen.queryByText("Pay button broken")).toBeNull();
    expect(erased).toEqual([{ requests: 2 }]);
    expect(unread.at(-1)).toBe(0);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  test("an expired session on erase keeps the dialog open with its words", async () => {
    stub({ erase: () => ({ status: 401 }) });
    await openList();
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my data" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await screen.findByText(/session expired/);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  test("a refused erase keeps the dialog open with the reason and keeps the list", async () => {
    stub({ erase: () => ({ status: 429 }) });
    const erased: unknown[] = [];
    await openList({ onErase: (detail) => erased.push(detail) });
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my data" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete" }),
    );
    await screen.findByText(/Too many requests from here/);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(erased).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Pay button broken")).toBeTruthy();
  });
});
