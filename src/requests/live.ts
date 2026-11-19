import { IDENTITY_HEADER } from "../api";

export type LiveEvent =
  | { type: "unread"; count: number }
  | { type: "updated"; id: string; unread: number }
  | { type: "expired" }
  /** The API refused the token (401 or 403): the stream is over. */
  | { type: "refused"; status: number };

/**
 * Reads `GET /public/live/requests` (server-sent events) with `fetch`, because an
 * `EventSource` cannot send the identity header. It runs until `signal` aborts or the
 * server ends the stream; a dropped connection is reopened after a pause that doubles up to
 * `maxRetryMs` (and starts over once a connection has opened), but never after `expired` (the
 * token is over) or a 401, 403, 404 or 429; a 401 or 403 is reported as `refused`. Pings
 * (`: ping`) are skipped.
 */
export async function streamRequests({
  apiBase,
  publicKey,
  identity,
  onEvent,
  signal,
  fetch: doFetch = fetch,
  retryMs = 1_000,
  maxRetryMs = 30_000,
  wait = pause,
}: {
  apiBase: string;
  publicKey: string;
  identity: string;
  onEvent: (event: LiveEvent) => void;
  signal: AbortSignal;
  fetch?: typeof fetch;
  retryMs?: number;
  maxRetryMs?: number;
  /** The pause between two connections; replaced in specs. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<void> {
  const url = `${apiBase.replace(/\/+$/, "")}/public/live/requests?key=${encodeURIComponent(publicKey)}`;
  let delay = retryMs;
  while (!signal.aborted) {
    let stop = false;
    try {
      const response = await doFetch(url, {
        headers: { [IDENTITY_HEADER]: identity, accept: "text/event-stream" },
        credentials: "omit",
        signal,
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => {});
        // A refusal does not get better by asking again.
        if ([401, 403, 404, 429].includes(response.status)) {
          if (response.status === 401 || response.status === 403)
            onEvent({ type: "refused", status: response.status });
          return;
        }
      } else {
        delay = retryMs;
        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value.replace(/\r\n/g, "\n");
          let cut = buffer.indexOf("\n\n");
          while (cut !== -1) {
            const event = parse(buffer.slice(0, cut));
            buffer = buffer.slice(cut + 2);
            if (event) {
              onEvent(event);
              if (event.type === "expired") stop = true;
            }
            cut = buffer.indexOf("\n\n");
          }
          if (stop) {
            await reader.cancel();
            break;
          }
        }
      }
    } catch {
      if (signal.aborted) return;
    }
    if (stop || signal.aborted) return;
    await wait(delay, signal);
    delay = Math.min(delay * 2, maxRetryMs);
  }
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function parse(block: string): LiveEvent | null {
  let name = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  let body: { count?: unknown; id?: unknown; unread?: unknown } = {};
  try {
    body = data ? JSON.parse(data) : {};
  } catch {
    return null;
  }
  if (name === "unread" && typeof body.count === "number")
    return { type: "unread", count: body.count };
  if (name === "request.updated" && typeof body.id === "string")
    return {
      type: "updated",
      id: body.id,
      unread: typeof body.unread === "number" ? body.unread : 0,
    };
  if (name === "expired") return { type: "expired" };
  return null;
}
