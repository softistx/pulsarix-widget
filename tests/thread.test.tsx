import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/app";
import { MESSAGES } from "../src/messages";

const originalFetch = globalThis.fetch;
const originalXhr = globalThis.XMLHttpRequest;

interface Call {
  id: string;
  variables: Record<string, unknown>;
}
let calls: Call[];
let puts: { url: string; ticket: string; name: string }[];
let detail: Record<string, unknown>;
let list: Record<string, unknown>[];
let failWith: { id: string; status: number; code: string } | null;
let streams: { identity: string | null; signal: AbortSignal | null }[];
let liveStatus: number | null;
let errors: { code: string }[];
let gate: { id: string; release: Promise<void> } | null;
let pushLive: ((text: string) => void) | null;

const message = (id: string, from: string, body: string, files = []) => ({
  id,
  from,
  body,
  at: "2026-11-17T10:00:00Z",
  files,
});

const base = {
  id: "r2",
  title: "How do I change the billing e-mail?",
  publicState: "received",
  impact: null,
  type: "question",
  createdAt: "2026-11-17T09:05:00Z",
  declineReason: null,
  unread: 2,
  description: "Where is the setting?",
  files: [],
  canReply: true,
  canReopen: false,
  resolvedAt: null,
  emailsOn: true,
  thread: [message("m1", "team", "Under Account, then Billing.")],
};

class FakeXhr {
  url = "";
  headers: Record<string, string> = {};
  status = 200;
  responseText = "{}";
  upload = {};
  onload?: () => void;
  onloadend?: () => void;
  body: unknown;
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body: File) {
    puts.push({
      url: this.url,
      ticket: this.headers["x-pulsarix-ticket"] ?? "",
      name: body.name,
    });
    setTimeout(() => {
      this.onload?.();
      this.onloadend?.();
    }, 0);
  }
  abort() {}
}

function install() {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    if (String(url).includes("/public/live/requests")) {
      if (liveStatus) return new Response("no", { status: liveStatus });
      streams.push({
        identity: headers["x-pulsarix-identity"] ?? null,
        signal: init.signal ?? null,
      });
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('event: unread\ndata: {"count":5}\n\n'),
          );
          pushLive = (text) => controller.enqueue(encoder.encode(text));
          init.signal?.addEventListener("abort", () => {
            try {
              controller.close();
            } catch {}
          });
        },
      });
      return new Response(body);
    }
    const body = JSON.parse(String(init.body));
    calls.push({ id: body.id, variables: body.variables });
    if (gate && gate.id === body.id) {
      // Only the first read waits; it answers with the thread as it was then.
      const held = gate;
      gate = null;
      const snapshot = detail;
      await held.release;
      return new Response(JSON.stringify({ data: { [body.id]: snapshot } }));
    }
    const ok = (data: object) =>
      new Response(JSON.stringify({ data: { [body.id]: data } }));
    if (failWith && failWith.id === body.id)
      return new Response(
        JSON.stringify({
          errors: [{ extensions: { code: `intake.errors.${failWith.code}` } }],
        }),
        { status: failWith.status },
      );
    switch (body.id) {
      case "widgetConfig":
        return ok({ projectName: "Shop", attachments: true });
      case "myRequests":
        return ok({
          nodes: list,
          counts: {
            open: list.length,
            resolved: 0,
            declined: 0,
            all: list.length,
          },
          unread: 2,
          emailsOn: true,
          endCursor: null,
          hasNextPage: false,
        });
      case "request":
        return ok(detail);
      case "markRequestRead":
        return ok({ count: 0 });
      case "replyToRequest":
        return ok({
          messageId: "m9",
          files: (body.variables.input.files ?? []).map(
            (_: unknown, i: number) => ({
              slot: `slot-${i}`,
              role: "file",
              ticket: `ticket-${i}`,
            }),
          ),
        });
      case "resolveRequest":
        detail = {
          ...detail,
          publicState: "resolved",
          canReopen: true,
          resolvedAt: "2026-11-18T10:00:00Z",
        };
        return ok(detail);
      case "reopenRequest":
        detail = { ...detail, publicState: "received", resolvedAt: null };
        return ok(detail);
      default:
        return new Response("{}", { status: 500 });
    }
  }) as unknown as typeof fetch;
}

let replies: unknown[];
let unreads: unknown[];
const props = () => ({
  messages: MESSAGES.en,
  locale: "en" as const,
  projectKey: "pk_live_abc",
  apiBase: "https://pulsarix.test",
  dark: false,
  launcher: true,
  position: "bottom-right" as const,
  identity: "a.b",
  open: true,
  onOpenChange: () => {},
  onSubmitted: () => {},
  onError: (d: { code: string }) => errors.push(d),
  onReply: (d: unknown) => replies.push(d),
  onUnreadChange: (d: unknown) => unreads.push(d),
});

async function openThread(row: Record<string, unknown> = base) {
  detail = { ...base, ...row };
  list = [detail];
  const view = render(<App {...props()} />);
  await userEvent.click(
    await screen.findByRole("tab", { name: /My requests/ }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: /Open request/ }),
  );
  return view;
}

beforeEach(() => {
  calls = [];
  puts = [];
  streams = [];
  pushLive = null;
  liveStatus = null;
  errors = [];
  gate = null;
  replies = [];
  unreads = [];
  failWith = null;
  install();
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  globalThis.XMLHttpRequest = originalXhr;
});

describe("request thread", () => {
  test("opening a request shows its messages and marks it read", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    screen.getByText("Where is the setting?");
    await waitFor(() =>
      expect(calls.some((c) => c.id === "markRequestRead")).toBe(true),
    );
    expect(calls.find((c) => c.id === "markRequestRead")?.variables).toEqual({
      publicKey: "pk_live_abc",
      id: "r2",
    });
    // The launcher's count moved with the read.
    await waitFor(() => expect(unreads.at(-1)).toEqual({ count: 0 }));
  });

  test("Back returns to the list", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("button", { name: /Open request/ });
  });

  test("a reply is sent with its text and the thread is read again", async () => {
    await openThread();
    const box = await screen.findByPlaceholderText("Write a reply...");
    await userEvent.type(box, "Thank you");
    const before = calls.filter((c) => c.id === "request").length;
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(calls.find((c) => c.id === "replyToRequest")).toBeTruthy(),
    );
    expect(calls.find((c) => c.id === "replyToRequest")?.variables).toEqual({
      publicKey: "pk_live_abc",
      id: "r2",
      input: { body: "Thank you" },
    });
    await waitFor(() =>
      expect(calls.filter((c) => c.id === "request").length).toBeGreaterThan(
        before,
      ),
    );
  });

  test("a reply with a file declares it and PUTs it with its ticket", async () => {
    await openThread();
    const box = await screen.findByPlaceholderText("Write a reply...");
    await userEvent.type(box, "See the picture");
    const input = document
      .querySelector("pulsarix-widget, body")
      ?.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(10)], "shot.png", {
      type: "image/png",
    });
    await userEvent.upload(input, file);
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({
      url: "https://pulsarix.test/public/media/report-files/slot-0",
      ticket: "ticket-0",
      name: "shot.png",
    });
    const sent = calls.find((c) => c.id === "replyToRequest");
    const declared = sent?.variables.input as { files: unknown[] } | undefined;
    expect(declared?.files).toEqual([
      { role: "file", name: "shot.png", type: "image/png", size: 10 },
    ]);
  });

  test("Resolve marks it resolved and offers Reopen", async () => {
    await openThread();
    await userEvent.click(
      await screen.findByRole("button", { name: "Resolve" }),
    );
    await screen.findByRole("button", { name: "Reopen" });
    expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await screen.findByRole("button", { name: "Resolve" });
  });

  test("a refused reopen (30 days) says so", async () => {
    await openThread({
      publicState: "resolved",
      canReopen: true,
      resolvedAt: "2026-10-01T10:00:00Z",
      unread: 0,
    });
    failWith = { id: "reopenRequest", status: 409, code: "reopen-expired" };
    await userEvent.click(
      await screen.findByRole("button", { name: "Reopen" }),
    );
    await screen.findByText(/can no longer be reopened/);
  });

  test("a resolved request past 30 days has no Reopen", async () => {
    await openThread({
      publicState: "resolved",
      canReopen: false,
      resolvedAt: "2026-09-01T10:00:00Z",
      unread: 0,
    });
    await screen.findByText(/more than 30 days ago/);
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  test("a declined request is read-only and shows its reason", async () => {
    await openThread({
      publicState: "declined",
      declineReason: "Not planned for this year.",
      canReply: false,
      unread: 0,
      thread: [],
    });
    await screen.findByText("Not planned for this year.");
    expect(screen.queryByPlaceholderText("Write a reply...")).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  test("the conversation is a log of the messages, with the composer under it", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    const log = screen.getByRole("log");
    expect(log.textContent).toContain("Under Account, then Billing.");
    expect(screen.getByPlaceholderText("Write a reply...")).toBeTruthy();
  });

  test("a read-only thread keeps its messages and says why the composer is off", async () => {
    await openThread({ canReply: false, publicState: "declined" });
    await screen.findByText("Under Account, then Billing.");
    screen.getByText("A declined request is read-only.");
    expect(screen.queryByPlaceholderText("Write a reply...")).toBeNull();
  });

  test("while the thread loads, a busy status with a skeleton stands in", async () => {
    const real = globalThis.fetch;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });
    detail = { ...base };
    list = [detail];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      if (init?.body && JSON.parse(String(init.body)).id === "request")
        await held;
      return real(url, init);
    }) as unknown as typeof fetch;
    render(<App {...props()} />);
    await userEvent.click(
      await screen.findByRole("tab", { name: /My requests/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Open request/ }),
    );
    const busy = await screen.findByText("Loading the conversation...");
    expect(busy.closest('[role="status"]')?.getAttribute("aria-busy")).toBe(
      "true",
    );
    release();
    await screen.findByText("Under Account, then Billing.");
  });

  test("the live stream carries the identity header, refreshes the thread and emits events", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0]?.identity).toBe("a.b");
    await waitFor(() => expect(pushLive).not.toBeNull());
    pushLive?.('event: unread\ndata: {"count":7}\n\n');
    await waitFor(() => expect(unreads).toContainEqual({ count: 7 }));
    // The team answers: the thread is read again and the page hears `reply`.
    detail = {
      ...detail,
      thread: [
        ...(detail.thread as unknown[]),
        message("m2", "team", "One more thing."),
      ],
    };
    pushLive?.(
      'event: request.updated\ndata: {"id":"r2","publicState":"received","unread":1}\n\n',
    );
    await screen.findByText("One more thing.");
    expect(replies).toContainEqual({ requestId: "r2" });
  });

  test("the first team reply of a thread with none is heard as a reply", async () => {
    await openThread();
    detail = {
      ...detail,
      unread: 0,
      thread: [message("m0", "user", "Hello?")],
    };
    await screen.findByText("Under Account, then Billing.");
    await waitFor(() => expect(pushLive).not.toBeNull());
    replies.length = 0;
    pushLive?.(
      'event: request.updated\ndata: {"id":"r2","publicState":"received","unread":0}\n\n',
    );
    await screen.findByText("Hello?");
    detail = {
      ...detail,
      thread: [
        message("m0", "user", "Hello?"),
        message("m3", "team", "First answer."),
      ],
    };
    pushLive?.(
      'event: request.updated\ndata: {"id":"r2","publicState":"received","unread":0}\n\n',
    );
    await screen.findByText("First answer.");
    expect(replies).toContainEqual({ requestId: "r2" });
  });

  test("the stream stops when the thread closes", async () => {
    await openThread();
    await waitFor(() => expect(streams).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(streams[0]?.signal?.aborted).toBe(true));
  });

  test("no stream runs while only the list is open", async () => {
    list = [base];
    render(<App {...props()} />);
    await userEvent.click(
      await screen.findByRole("tab", { name: /My requests/ }),
    );
    await screen.findByRole("button", { name: /Open request/ });
    expect(streams).toHaveLength(0);
  });

  test("an expired token ends the stream, shows the identity error and tells the page", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    await waitFor(() => expect(pushLive).not.toBeNull());
    pushLive?.("event: expired\ndata: {}\n\n");
    await screen.findByText(/Your session expired/);
    expect(errors).toEqual([{ code: "intake.errors.identity-expired" }]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(streams).toHaveLength(1);
  });

  test("a stream refused with 401 shows the identity error and tells the page", async () => {
    liveStatus = 401;
    await openThread();
    await screen.findByText(/Your session expired/);
    expect(errors).toEqual([{ code: "http-401" }]);
  });

  test("a thread read refused for its identity tells the page", async () => {
    failWith = { id: "request", status: 401, code: "identity-invalid" };
    await openThread();
    await screen.findByText(/Your session expired/);
    expect(errors).toEqual([{ code: "intake.errors.identity-invalid" }]);
  });

  test("a thread that cannot be read says so and offers no composer", async () => {
    failWith = { id: "request", status: 503, code: "unavailable" };
    await openThread();
    await screen.findByText(/busy right now/);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("a failed reply keeps the typed text and shows the error", async () => {
    await openThread();
    await screen.findByText("Under Account, then Billing.");
    failWith = { id: "replyToRequest", status: 429, code: "rate-limited" };
    const box = await screen.findByRole("textbox");
    await userEvent.type(box, "Hello again");
    await userEvent.click(screen.getByRole("button", { name: /Send/ }));
    await screen.findByText(/Too many requests/);
    expect((box as HTMLTextAreaElement).value).toBe("Hello again");
  });

  test("an older read that lands late cannot overwrite a newer one", async () => {
    let release = () => {};
    gate = {
      id: "request",
      release: new Promise<void>((resolve) => {
        release = resolve;
      }),
    };
    await openThread();
    await waitFor(() => expect(pushLive).not.toBeNull());
    // The first read is held; a newer one answers with the team's second message.
    detail = {
      ...detail,
      thread: [
        ...(detail.thread as unknown[]),
        message("m2", "team", "Newest answer."),
      ],
    };
    pushLive?.(
      'event: request.updated\ndata: {"id":"r2","publicState":"received","unread":1}\n\n',
    );
    await screen.findByText("Newest answer.");
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("Newest answer.")).toBeTruthy();
  });

  test("a reply in another request is heard only when its unread count grows", async () => {
    await openThread();
    await waitFor(() => expect(pushLive).not.toBeNull());
    const other = (unread: number) =>
      `event: request.updated\ndata: {"id":"r9","publicState":"received","unread":${unread}}\n\n`;
    pushLive?.(other(1));
    await waitFor(() => expect(replies).toContainEqual({ requestId: "r9" }));
    replies.length = 0;
    pushLive?.(other(1));
    pushLive?.(other(0));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(replies).toHaveLength(0);
    pushLive?.(other(1));
    await waitFor(() => expect(replies).toHaveLength(1));
  });
});
