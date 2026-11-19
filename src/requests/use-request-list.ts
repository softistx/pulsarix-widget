import { useCallback, useEffect, useRef, useState } from "react";
import { IntakeError } from "../api";
import type { Locale } from "../config";
import {
  fetchMyRequests,
  type MyRequests,
  type RequestCounts,
  type RequestFilter,
  type RequestSummary,
} from "./api";

export type Load =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: IntakeError };

/**
 * The list's data: the page of requests for a filter, their counts, the paging cursor and the
 * state of the read. It reads on mount and on each filter or retry (`reload`), and `append`
 * reads the next page. `onUnread` is read through a ref: a caller passing a fresh function each
 * render must not change `read`, which would refetch the list in a loop.
 */
export function useRequestList({
  apiBase,
  projectKey,
  identity,
  locale,
  onUnread,
  onError,
}: {
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
  locale: Locale;
  onUnread: (count: number) => void;
  /** The identity was refused or expired. */
  onError?: (detail: { code: string }) => void;
}) {
  const [filter, setFilter] = useState<RequestFilter>("OPEN");
  const [counts, setCounts] = useState<RequestCounts | null>(null);
  const [nodes, setNodes] = useState<RequestSummary[]>([]);
  const [next, setNext] = useState<{ cursor: string | null; more: boolean }>({
    cursor: null,
    more: false,
  });
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [paging, setPaging] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The e-mail choice as the API last said it (the privacy section owns the optimistic edit).
  const [emailsOn, setEmailsOn] = useState(true);
  const [erased, setErased] = useState<number | null>(null);
  const aborted = useRef<AbortController | null>(null);
  const unread = useRef(onUnread);
  unread.current = onUnread;
  const fail = useRef(onError);
  fail.current = onError;

  const read = useCallback(
    async (after: string | null) => {
      aborted.current?.abort();
      const controller = new AbortController();
      aborted.current = controller;
      if (!apiBase || !projectKey) {
        setLoad({
          status: "error",
          error: new IntakeError("config", "config"),
        });
        return;
      }
      try {
        const page: MyRequests = await fetchMyRequests({
          apiBase,
          publicKey: projectKey,
          identity,
          locale,
          filter,
          after,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setCounts(page.counts);
        if (page.counts.all > 0) setErased(null);
        setEmailsOn(page.emailsOn);
        unread.current(page.unread);
        setNodes((rows) => (after ? [...rows, ...page.nodes] : page.nodes));
        setNext({ cursor: page.endCursor, more: page.hasNextPage });
        setLoad({ status: "ready" });
      } catch (error) {
        if (controller.signal.aborted) return;
        const failed =
          error instanceof IntakeError
            ? error
            : new IntakeError("unknown", "unknown");
        setLoad({ status: "error", error: failed });
        if (failed.kind === "identity") fail.current?.({ code: failed.code });
      } finally {
        if (!controller.signal.aborted) setPaging(false);
      }
    },
    [apiBase, projectKey, identity, locale, filter],
  );

  // A filter (or a retry) starts a fresh read: its rows replace the old ones.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` only re-runs the read
  useEffect(() => {
    setLoad({ status: "loading" });
    setNodes([]);
    void read(null);
    return () => aborted.current?.abort();
  }, [read, attempt]);

  /** Reads the next page and appends it. */
  const more = () => {
    setPaging(true);
    void read(next.cursor);
  };
  /** A read again from the first page (a retry, or back from a thread that may have changed things). */
  const reload = () => setAttempt((n) => n + 1);
  /** "Delete my data" erased the reporter's requests: the list is emptied without a read. */
  const empty = (requests: number) => {
    aborted.current?.abort();
    setNodes([]);
    setCounts({ open: 0, resolved: 0, declined: 0, all: 0 });
    setNext({ cursor: null, more: false });
    setLoad({ status: "ready" });
    setErased(requests);
    unread.current(0);
  };

  return {
    filter,
    setFilter,
    counts,
    nodes,
    hasMore: next.more,
    load,
    paging,
    emailsOn,
    erased,
    more,
    reload,
    empty,
  };
}
