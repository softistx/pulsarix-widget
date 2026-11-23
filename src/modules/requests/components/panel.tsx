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
import { Preferences } from "./preferences";
import Thread from "./thread";

/** A gear, for the preferences. */
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

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
  // The preferences view (e-mails, "Delete my data"), opened from the list's header.
  const [prefs, setPrefs] = useState(false);

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
  if (prefs)
    return (
      <Preferences
        locale={locale}
        apiBase={apiBase}
        projectKey={projectKey}
        identity={identity}
        emailsOn={list.emailsOn}
        onBack={() => setPrefs(false)}
        onErased={(requests) => {
          list.empty(requests);
          onErase?.({ requests });
          setPrefs(false);
        }}
      />
    );
  const hasRequests =
    list.load.status === "ready" && (list.counts?.all ?? 0) > 0;
  return (
    <>
      <DialogHeader>
        <div className="flex items-start justify-between gap-2 pe-12">
          <DialogTitle>{messages.myRequests}</DialogTitle>
          {hasRequests ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={text.prefs.open}
              onClick={() => setPrefs(true)}
            >
              <GearIcon />
            </Button>
          ) : null}
        </div>
        <DialogDescription>{text.description}</DialogDescription>
      </DialogHeader>
      <DialogBody role="region" aria-label={messages.myRequests}>
        <RequestsListBody
          messages={messages}
          locale={locale}
          list={list}
          onOpen={setOpened}
          onNewRequest={onNewRequest}
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
