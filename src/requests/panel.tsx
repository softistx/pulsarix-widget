import {
  Alert,
  Button,
  ChipGroupField,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SkeletonText,
} from "@softistx/material/embed";
import { type ReactNode, useState } from "react";
import type { Locale } from "../config";
import type { Messages } from "../messages";
import type { RequestCounts, RequestFilter, RequestSummary } from "./api";
import { errorText } from "./error-text";
import { REQUESTS_MESSAGES } from "./messages";
import { Privacy } from "./privacy";
import { RequestList } from "./request-list";
import Thread from "./thread";
import { useRequestList } from "./use-request-list";

const FILTERS: RequestFilter[] = ["OPEN", "RESOLVED", "DECLINED", "ALL"];
const COUNT_KEY: Record<RequestFilter, keyof RequestCounts> = {
  OPEN: "open",
  RESOLVED: "resolved",
  DECLINED: "declined",
  ALL: "all",
};
export interface RequestsPanelProps {
  messages: Messages;
  locale: Locale;
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
  /** Rendered in the dialog's header, under the description (the tabs). */
  headerExtra?: ReactNode;
  /**
   * The unread count over every request, as the API last said it (the launcher's badge). It is
   * called from the list's read, and any identity is fine: the panel keeps it in a ref.
   */
  onUnread: (count: number) => void;
  /** A team reply arrived while a thread was open. */
  onReply?: (detail: { requestId: string }) => void;
  /** The identity was refused or expired (the page hears `pulsarix:error`). */
  onError?: (detail: { code: string }) => void;
  /** "Delete my data" erased this many requests (the page hears `pulsarix:erase`). */
  onErase?: (detail: { requests: number }) => void;
  onClose: () => void;
  /** The "New request" action of the first-use state. */
  onNewRequest: () => void;
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
  onError,
  onErase,
  onClose,
  onNewRequest,
}: RequestsPanelProps) {
  const text = REQUESTS_MESSAGES[locale];
  const list = useRequestList({
    apiBase,
    projectKey,
    identity,
    locale,
    onUnread,
    onError,
  });
  const { filter, counts, nodes, load } = list;
  // The request whose thread is open; the list stays mounted behind it, so its filter holds.
  const [opened, setOpened] = useState<RequestSummary | null>(null);
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
        onError={(detail) => onError?.(detail)}
        onBack={() => {
          setOpened(null);
          // The thread may have changed the state, the counts and the unread marks.
          list.reload();
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
                value && list.setFilter(value as RequestFilter)
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
                        onClick={list.reload}
                      >
                        {text.retry}
                      </Button>
                    ),
                  })}
            />
          ) : null}
          {list.erased !== null ? (
            <Alert
              variant="success"
              description={text.privacy.erased(list.erased)}
            />
          ) : null}
          {load.status === "loading" ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{text.loading}</span>
              <SkeletonText lines={4} labelled={false} />
            </div>
          ) : null}
          {load.status === "ready" && nodes.length === 0 ? (
            total === 0 ? (
              <EmptyState
                size="compact"
                headingLevel={3}
                title={text.none.title}
                description={text.none.body}
                action={
                  <Button type="button" onClick={onNewRequest}>
                    {text.none.action}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                kind="search"
                size="compact"
                title={filter === "ALL" ? text.none.title : text.empty[filter]}
              />
            )
          ) : null}
          {nodes.length > 0 ? (
            <RequestList
              messages={messages}
              locale={locale}
              label={text.filters[filter]}
              nodes={nodes}
              onOpen={setOpened}
            />
          ) : null}
          {list.hasMore && load.status === "ready" ? (
            <Button
              type="button"
              variant="tonal"
              loading={list.paging}
              className="justify-self-center"
              onClick={list.more}
            >
              {text.more}
            </Button>
          ) : null}
          {load.status === "ready" && (total ?? 0) > 0 ? (
            <Privacy
              locale={locale}
              apiBase={apiBase}
              projectKey={projectKey}
              identity={identity}
              emailsOn={list.emailsOn}
              onErased={(requests) => {
                list.empty(requests);
                onErase?.({ requests });
              }}
            />
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
