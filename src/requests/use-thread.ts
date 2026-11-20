import { useCallback, useEffect, useRef, useState } from "react";
import type { IntakeError } from "../api";
import type { Locale } from "../config";
import type { RequestDetail } from "./api";
import { failure } from "./failure";
import { streamRequests } from "./live";
import { readThread } from "./thread-read";
import { threadStreamHandler } from "./thread-stream";

export type Load =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: IntakeError };

export interface UseThreadOptions {
  locale: Locale;
  apiBase: string;
  projectKey: string;
  identity: string;
  requestId: string;
  onUnread: (count: number) => void;
  onReply: (detail: { requestId: string }) => void;
  onError: (detail: { code: string }) => void;
}

/**
 * The page hears an identity failure once per thread, whichever of the read or the stream sees
 * it first; `rearm` starts a new thread.
 */
function useReportOnce(hear: {
  current: { onError: (d: { code: string }) => void };
}) {
  const reported = useRef(false);
  const tell = useCallback(
    (code: string) => {
      if (reported.current) return;
      reported.current = true;
      hear.current.onError({ code });
    },
    [hear],
  );
  const rearm = useCallback(() => {
    reported.current = false;
  }, []);
  return { tell, rearm };
}

/**
 * Reads one request's thread, marks it read when team replies wait in it, and keeps it fresh
 * with the live stream until the component unmounts. `aborted` holds the controller of the
 * current mount, shared with the reply and state actions.
 */
export function useThread({
  locale,
  apiBase,
  projectKey,
  identity,
  requestId,
  onUnread,
  onReply,
  onError,
}: UseThreadOptions) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const aborted = useRef(new AbortController());
  const seen = useRef<number | null>(null);
  // The page's callbacks change on every render; the stream must not restart for that.
  const hear = useRef({ onUnread, onReply, onError });
  hear.current = { onUnread, onReply, onError };
  // Only the newest read may write: an older one that lands late is dropped.
  const reads = useRef(0);
  const { tell, rearm } = useReportOnce(hear);
  // The unread count last heard for each other request, so a reply is heard when it grows.
  const heard = useRef(new Map<string, number>());

  /** Reads the thread; marks it read when team replies wait in it. */
  const read = useCallback(async () => {
    const turn = ++reads.current;
    const current = () =>
      !aborted.current.signal.aborted && turn === reads.current;
    try {
      await readThread({
        call: { apiBase, publicKey: projectKey, identity, locale },
        requestId,
        signal: aborted.current.signal,
        current,
        seen,
        hear,
        onDetail: (next) => {
          setDetail(next);
          setLoad({ status: "ready" });
        },
      });
    } catch (error) {
      if (!current()) return;
      const failed = failure(error);
      setLoad({ status: "error", error: failed });
      if (failed.kind === "identity") tell(failed.code);
    }
  }, [apiBase, projectKey, identity, locale, requestId, tell]);

  // The thread is read on mount and the stream runs until it unmounts (close, back).
  useEffect(() => {
    const controller = new AbortController();
    aborted.current = controller;
    seen.current = null;
    heard.current.clear();
    rearm();
    void read();
    void streamRequests({
      apiBase,
      publicKey: projectKey,
      identity,
      signal: controller.signal,
      onEvent: threadStreamHandler({
        requestId,
        signal: controller.signal,
        heard: heard.current,
        hear,
        read: () => void read(),
        end: (code, error) => {
          setLoad({ status: "error", error });
          tell(code);
        },
      }),
    });
    return () => controller.abort();
  }, [apiBase, projectKey, identity, requestId, read, tell, rearm]);

  return { detail, load, read, aborted };
}
