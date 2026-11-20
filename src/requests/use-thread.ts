import { useCallback, useEffect, useRef, useState } from "react";
import { IntakeError } from "../api";
import type { Locale } from "../config";
import { fetchRequest, markRequestRead, type RequestDetail } from "./api";
import { streamRequests } from "./live";

export const failure = (error: unknown): IntakeError =>
  error instanceof IntakeError ? error : new IntakeError("unknown", "unknown");

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
  // The page hears an identity failure once per thread, whichever of the read or the stream sees it first.
  const reported = useRef(false);
  const tell = useCallback((code: string) => {
    if (reported.current) return;
    reported.current = true;
    hear.current.onError({ code });
  }, []);
  // The unread count last heard for each other request, so a reply is heard when it grows.
  const heard = useRef(new Map<string, number>());

  /** Reads the thread; marks it read when team replies wait in it. */
  const read = useCallback(async () => {
    const turn = ++reads.current;
    const current = () =>
      !aborted.current.signal.aborted && turn === reads.current;
    try {
      const next = await fetchRequest({
        apiBase,
        publicKey: projectKey,
        identity,
        locale,
        id: requestId,
        signal: aborted.current.signal,
      });
      if (!current()) return;
      setDetail(next);
      setLoad({ status: "ready" });
      const team = next.thread.filter((m) => m.from === "team").length;
      if (seen.current !== null && team > seen.current)
        hear.current.onReply({ requestId });
      seen.current = team;
      if (next.unread > 0) {
        const read = await markRequestRead({
          apiBase,
          publicKey: projectKey,
          identity,
          locale,
          id: requestId,
          signal: aborted.current.signal,
        });
        if (current()) hear.current.onUnread(read.count);
      }
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
    reported.current = false;
    void read();
    void streamRequests({
      apiBase,
      publicKey: projectKey,
      identity,
      signal: controller.signal,
      onEvent: (event) => {
        if (controller.signal.aborted) return;
        if (event.type === "unread") hear.current.onUnread(event.count);
        else if (event.type === "updated") {
          if (event.id === requestId) void read();
          else {
            const before = heard.current.get(event.id) ?? 0;
            heard.current.set(event.id, event.unread);
            if (event.unread > before)
              hear.current.onReply({ requestId: event.id });
          }
        } else {
          // The token expired (`expired`) or was refused (401, 403): the thread says so.
          const code =
            event.type === "expired"
              ? "intake.errors.identity-expired"
              : `http-${event.status}`;
          setLoad({
            status: "error",
            error: new IntakeError("identity", code),
          });
          tell(code);
        }
      },
    });
    return () => controller.abort();
  }, [apiBase, projectKey, identity, requestId, read, tell]);

  return { detail, load, read, aborted };
}
