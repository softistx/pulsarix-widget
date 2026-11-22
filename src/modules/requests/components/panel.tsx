import {
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import { useState } from "react";
import type { Locale } from "../../../config";
import type { Messages } from "../../../core/messages";
import type { RequestSummary } from "../api";
import { useRequestList } from "../hooks/use-request-list";
import { REQUESTS_MESSAGES } from "../model/messages";
import { RequestsListBody } from "./panel-list";
import Thread from "./thread";

export interface RequestsPanelProps {
  messages: Messages;
  locale: Locale;
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
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
  // The request whose thread is open; the list stays mounted behind it, so its filter holds.
  const [opened, setOpened] = useState<RequestSummary | null>(null);

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
        <DialogTitle>{messages.myRequests}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
      </DialogHeader>
      <DialogBody role="region" aria-label={messages.myRequests}>
        <RequestsListBody
          messages={messages}
          locale={locale}
          apiBase={apiBase}
          projectKey={projectKey}
          identity={identity}
          list={list}
          onOpen={setOpened}
          onNewRequest={onNewRequest}
          onErase={onErase}
        />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="tonal" onClick={onClose}>
          {messages.close}
        </Button>
      </DialogFooter>
    </>
  );
}
