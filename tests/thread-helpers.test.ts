import { describe, expect, test } from "bun:test";
import { IntakeError } from "../src/api";
import { failure } from "../src/requests/failure";
import { filesOversize, uploadFiles } from "../src/requests/reply-files";
import {
  endCode,
  teamCount,
  threadStreamHandler,
} from "../src/requests/thread-stream";

describe("failure", () => {
  test("keeps an IntakeError and wraps anything else as unknown", () => {
    const own = new IntakeError("identity", "x");
    expect(failure(own)).toBe(own);
    const other = failure(new Error("boom"));
    expect(other).toBeInstanceOf(IntakeError);
    expect(other.kind).toBe("unknown");
    expect(other.code).toBe("unknown");
  });
});

describe("teamCount and endCode", () => {
  test("counts the team's messages only", () => {
    expect(
      teamCount([{ from: "team" }, { from: "you" }, { from: "team" }]),
    ).toBe(2);
    expect(teamCount([])).toBe(0);
  });

  test("names the code that ends the stream", () => {
    expect(endCode({ type: "expired" })).toBe("intake.errors.identity-expired");
    expect(endCode({ type: "refused", status: 403 })).toBe("http-403");
  });
});

describe("threadStreamHandler", () => {
  const setup = (signal = new AbortController().signal) => {
    const calls: string[] = [];
    const heard = new Map<string, number>();
    const handler = threadStreamHandler({
      requestId: "r1",
      signal,
      heard,
      hear: {
        current: {
          onUnread: (count) => calls.push(`unread:${count}`),
          onReply: ({ requestId }) => calls.push(`reply:${requestId}`),
        },
      },
      read: () => calls.push("read"),
      end: (code, error) => calls.push(`end:${code}:${error.kind}`),
    });
    return { calls, heard, handler };
  };

  test("passes the unread count on", () => {
    const { calls, handler } = setup();
    handler({ type: "unread", count: 3 });
    expect(calls).toEqual(["unread:3"]);
  });

  test("re-reads this thread, hears another request's growing unread once", () => {
    const { calls, heard, handler } = setup();
    handler({ type: "updated", id: "r1", unread: 1 });
    handler({ type: "updated", id: "r2", unread: 1 });
    handler({ type: "updated", id: "r2", unread: 1 });
    handler({ type: "updated", id: "r2", unread: 2 });
    expect(calls).toEqual(["read", "reply:r2", "reply:r2"]);
    expect(heard.get("r2")).toBe(2);
  });

  test("reports the events that end the stream as identity errors", () => {
    const { calls, handler } = setup();
    handler({ type: "expired" });
    handler({ type: "refused", status: 401 });
    expect(calls).toEqual([
      "end:intake.errors.identity-expired:identity",
      "end:http-401:identity",
    ]);
  });

  test("ignores events once aborted", () => {
    const controller = new AbortController();
    const { calls, handler } = setup(controller.signal);
    controller.abort();
    handler({ type: "unread", count: 1 });
    handler({ type: "expired" });
    expect(calls).toEqual([]);
  });
});

describe("reply files", () => {
  const file = (size: number, type = "image/png") => {
    const f = new File(["x"], "a.png", { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
  };

  test("filesOversize checks type, one size and the total", () => {
    expect(filesOversize([file(10)])).toBe(false);
    expect(filesOversize([file(10, "text/plain")])).toBe(true);
    expect(filesOversize([file(5 * 1024 * 1024 + 1)])).toBe(true);
    expect(
      filesOversize([
        file(5 * 1024 * 1024),
        file(5 * 1024 * 1024),
        file(3 * 1024 * 1024),
      ]),
    ).toBe(true);
  });

  test("uploadFiles lists the files that had no ticket", async () => {
    const failed = await uploadFiles({
      apiBase: "https://api.example",
      files: [file(1)],
      tickets: [],
      signal: new AbortController().signal,
    });
    expect(failed).toEqual(["a.png"]);
  });
});
