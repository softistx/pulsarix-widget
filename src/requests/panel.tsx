import {
  Alert,
  Badge,
  Button,
  ChipGroupField,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ListRow,
} from "@softistx/material/embed";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IntakeError } from "../api";
import type { Locale } from "../config";
import type { Messages } from "../messages";
import {
  fetchMyRequests,
  type MyRequests,
  type PublicState,
  type RequestCounts,
  type RequestFilter,
  type RequestSummary,
} from "./api";
import { REQUESTS_MESSAGES, type RequestsMessages } from "./messages";
import Thread from "./thread";

const FILTERS: RequestFilter[] = ["OPEN", "RESOLVED", "DECLINED", "ALL"];
const COUNT_KEY: Record<RequestFilter, keyof RequestCounts> = {
  OPEN: "open",
  RESOLVED: "resolved",
  DECLINED: "declined",
  ALL: "all",
};
const STATE_TONE = {
  received: "neutral",
  inProgress: "info",
  resolved: "success",
  declined: "warning",
} as const satisfies Record<PublicState, string>;

export interface RequestsPanelProps {
  messages: Messages;
  locale: Locale;
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
  /** Rendered in the dialog's header, under the description (the tabs). */
  headerExtra?: ReactNode;
  /** The unread count over every request, as the API last said it (the launcher's badge). */
  onUnread: (count: number) => void;
  /** A team reply arrived while a thread was open. */
  onReply?: (detail: { requestId: string }) => void;
  onClose: () => void;
  /** The "New request" action of the first-use state. */
  onNewRequest: () => void;
}

type Load =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: IntakeError };

/** The words of a failed read; the API's own code is never shown. */
function errorText(text: RequestsMessages, error: IntakeError): string {
  switch (error.kind) {
    case "identity":
      return text.errors.identity;
    case "unavailable":
      return text.errors.unavailable;
    case "rate-limited":
      return text.errors.rateLimited;
    case "network":
      return text.errors.network;
    default:
      return text.errors.unknown;
  }
}

/**
 * "My requests": one list with filter chips and their counts, unread first. It reads on mount
 * (the dialog's content mounts on each opening, so this is the refresh on open) and on each
 * filter. Opening a request is the thread view (a later slice).
 */
export default function RequestsPanel({
  messages,
  locale,
  apiBase,
  projectKey,
  identity,
  headerExtra,
  onUnread,
  onReply,
  onClose,
  onNewRequest,
}: RequestsPanelProps) {
  const text = REQUESTS_MESSAGES[locale];
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
  // The request whose thread is open; the list stays mounted behind it, so its filter holds.
  const [opened, setOpened] = useState<RequestSummary | null>(null);
  const aborted = useRef<AbortController | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

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
        onUnread(page.unread);
        setNodes((rows) => (after ? [...rows, ...page.nodes] : page.nodes));
        setNext({ cursor: page.endCursor, more: page.hasNextPage });
        setLoad({ status: "ready" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({
          status: "error",
          error:
            error instanceof IntakeError
              ? error
              : new IntakeError("unknown", "unknown"),
        });
      } finally {
        if (!controller.signal.aborted) setPaging(false);
      }
    },
    [apiBase, projectKey, identity, locale, filter, onUnread],
  );

  // A filter (or a retry) starts a fresh read: its rows replace the old ones.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` only re-runs the read
  useEffect(() => {
    setLoad({ status: "loading" });
    setNodes([]);
    void read(null);
    return () => aborted.current?.abort();
  }, [read, attempt]);

  const stateBadge = (state: PublicState) => (
    <Badge variant="soft" tone={STATE_TONE[state]}>
      {text.states[state]}
    </Badge>
  );
  const total = counts?.all ?? null;
  if (opened && apiBase && projectKey)
    return (
      <Thread
        locale={locale}
        apiBase={apiBase}
        projectKey={projectKey}
        identity={identity}
        requestId={opened.id}
        title={opened.title}
        onUnread={onUnread}
        onReply={(detail) => onReply?.(detail)}
        onBack={() => {
          setOpened(null);
          // The thread may have changed the state, the counts and the unread marks.
          setAttempt((n) => n + 1);
        }}
      />
    );
  return (
    <>
      <DialogHeader>
        <DialogTitle>{messages.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
        {headerExtra}
      </DialogHeader>
      <DialogBody role="region" aria-label={messages.tabs.myRequests}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          {total === 0 && load.status === "ready" ? null : (
            <ChipGroupField
              label={text.filterLabel}
              hideLabel
              overflow="scroll-phone"
              value={filter}
              onValueChange={(value) =>
                value && setFilter(value as RequestFilter)
              }
              options={FILTERS.map((value) => ({
                value,
                label: text.filters[value],
                ...(counts ? { count: counts[COUNT_KEY[value]] } : {}),
              }))}
            />
          )}
          {load.status === "error" ? (
            <Alert
              variant="error"
              title={text.errors.title}
              description={errorText(text, load.error)}
              {...(load.error.kind === "identity"
                ? {}
                : {
                    actions: (
                      <Button
                        type="button"
                        variant="tonal"
                        size="sm"
                        onClick={() => setAttempt((n) => n + 1)}
                      >
                        {text.retry}
                      </Button>
                    ),
                  })}
            />
          ) : null}
          {load.status === "loading" ? (
            <p role="status" className="text-muted-foreground text-sm">
              {text.loading}
            </p>
          ) : null}
          {load.status === "ready" && nodes.length === 0 ? (
            total === 0 ? (
              <div className="grid justify-items-center gap-2 rounded-lg bg-card px-4 py-10 text-center">
                <p className="font-semibold text-foreground text-sm">
                  {text.none.title}
                </p>
                <p className="max-w-[320px] text-muted-foreground text-sm">
                  {text.none.body}
                </p>
                <Button type="button" className="mt-2" onClick={onNewRequest}>
                  {text.none.action}
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-card px-4 py-8 text-center text-muted-foreground text-sm">
                {filter === "ALL" ? text.none.title : text.empty[filter]}
              </p>
            )
          ) : null}
          {nodes.length > 0 ? (
            <ul
              aria-label={text.filters[filter]}
              className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0"
            >
              {nodes.map((request) => (
                <li
                  key={request.id}
                  // A container, so the badge moves by the list's width, not the window's.
                  className="@container min-w-0 rounded-lg bg-card"
                >
                  <button
                    type="button"
                    aria-label={text.open(request.title)}
                    onClick={() => setOpened(request)}
                    className="block w-full cursor-pointer rounded-lg text-left"
                  >
                    <ListRow
                      unread={request.unread > 0}
                      title={request.title}
                      meta={
                        <>
                          <span className="@md:hidden">
                            {stateBadge(request.publicState)}{" "}
                          </span>
                          {[
                            date.format(new Date(request.createdAt)),
                            request.type
                              ? messages.choices.type[
                                  request.type as keyof typeof messages.choices.type
                                ]
                              : null,
                            request.impact
                              ? messages.choices.impact[
                                  request.impact as keyof typeof messages.choices.impact
                                ]
                              : null,
                            request.unread > 0
                              ? text.newReplies(request.unread)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </>
                      }
                      badge={
                        <span className="hidden @md:inline-flex">
                          {stateBadge(request.publicState)}
                        </span>
                      }
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {next.more && load.status === "ready" ? (
            <Button
              type="button"
              variant="tonal"
              loading={paging}
              className="justify-self-center"
              onClick={() => {
                setPaging(true);
                void read(next.cursor);
              }}
            >
              {text.more}
            </Button>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="tonal" onClick={onClose}>
          {messages.close}
        </Button>
      </DialogFooter>
    </>
  );
}
