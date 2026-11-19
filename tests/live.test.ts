import { describe, expect, test } from "bun:test";
import { type LiveEvent, streamRequests } from "../src/requests/live";

const encoder = new TextEncoder();
const stream = (...chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );

/** Runs the stream against scripted responses; the run ends when they are used up. */
async function run(
  responses: Array<Response | Error>,
  options: { retryMs?: number; maxRetryMs?: number } = {},
) {
  const controller = new AbortController();
  const events: LiveEvent[] = [];
  const waits: number[] = [];
  const queue = [...responses];
  let calls = 0;
  await streamRequests({
    apiBase: "https://pulsarix.test/",
    publicKey: "pk_live_abc",
    identity: "a.b",
    signal: controller.signal,
    onEvent: (event) => events.push(event),
    retryMs: options.retryMs ?? 10,
    maxRetryMs: options.maxRetryMs ?? 40,
    wait: async (ms) => {
      waits.push(ms);
      if (queue.length === 0) controller.abort();
    },
    fetch: (async () => {
      calls += 1;
      const next = queue.shift();
      if (!next) {
        controller.abort();
        throw new Error("done");
      }
      if (next instanceof Error) throw next;
      return next;
    }) as unknown as typeof fetch,
  });
  return { events, waits, calls };
}

const unread = (count: number) => `event: unread\ndata: {"count":${count}}\n\n`;

describe("streamRequests", () => {
  test("reads events, skips pings and handles CRLF line ends", async () => {
    const { events } = await run([
      stream(": ping\n\n", unread(3).replace(/\n/g, "\r\n")),
    ]);
    expect(events).toEqual([{ type: "unread", count: 3 }]);
  });

  test("a block cut across two chunks is read once whole", async () => {
    const { events } = await run([
      stream("event: unread\nda", 'ta: {"count":4}\n\n'),
    ]);
    expect(events).toEqual([{ type: "unread", count: 4 }]);
  });

  test("a malformed or unknown block is skipped and the next one is read", async () => {
    const { events } = await run([
      stream(
        "event: unread\ndata: {not json}\n\n",
        "event: other\ndata: {}\n\n",
        'event: request.updated\ndata: {"id":"r1","unread":2}\n\n',
        "event: unread\ndata: {}\n\n",
      ),
    ]);
    expect(events).toEqual([{ type: "updated", id: "r1", unread: 2 }]);
  });

  test("expired is reported and the stream is not reopened", async () => {
    const { events, calls } = await run([
      stream("event: expired\ndata: {}\n\n"),
      stream(unread(9)),
    ]);
    expect(events).toEqual([{ type: "expired" }]);
    expect(calls).toBe(1);
  });

  for (const status of [401, 403, 404, 429]) {
    test(`a ${status} is not retried`, async () => {
      const { events, calls } = await run([
        new Response("no", { status }),
        stream(unread(1)),
      ]);
      expect(calls).toBe(1);
      expect(events).toEqual(
        status === 401 || status === 403 ? [{ type: "refused", status }] : [],
      );
    });
  }

  test("a non-ok body is cancelled", async () => {
    let cancelled = false;
    const body = new ReadableStream({
      cancel() {
        cancelled = true;
      },
    });
    await run([new Response(body, { status: 429 })]);
    expect(cancelled).toBe(true);
  });

  test("a dropped connection is reopened with a doubling pause up to the cap", async () => {
    const { waits, calls } = await run(
      [
        new Error("x"),
        new Error("x"),
        new Error("x"),
        new Error("x"),
        new Error("x"),
      ],
      { retryMs: 10, maxRetryMs: 40 },
    );
    expect(calls).toBe(5);
    expect(waits.slice(0, 5)).toEqual([10, 20, 40, 40, 40]);
  });

  test("a connection that opened starts the pause over", async () => {
    const { waits, events } = await run(
      [new Error("x"), new Error("x"), stream(unread(1)), new Error("x")],
      { retryMs: 10, maxRetryMs: 40 },
    );
    expect(events).toEqual([{ type: "unread", count: 1 }]);
    expect(waits.slice(0, 4)).toEqual([10, 20, 10, 20]);
  });

  test("a 500 is retried", async () => {
    const { events, calls } = await run([
      new Response("boom", { status: 500 }),
      stream(unread(2)),
    ]);
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(events).toEqual([{ type: "unread", count: 2 }]);
  });
});
