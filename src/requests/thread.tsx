import {
  Alert,
  Badge,
  Button,
  ChatMessage,
  ChatMessageSeparator,
  ChatThread,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NonceProvider,
  SkeletonText,
} from "@softistx/material/embed";
import { useCallback, useEffect, useRef, useState } from "react";
import { IntakeError } from "../api";
import type { Locale } from "../config";
import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "../files/rules";
import { putFile } from "../files/upload";
import {
  fetchRequest,
  markRequestRead,
  type PublicState,
  type RequestDetail,
  reopenRequest,
  replyToRequest,
  resolveRequest,
} from "./api";
import { streamRequests } from "./live";
import { REQUESTS_MESSAGES } from "./messages";
import { pageNonce } from "./nonce";

const STATE_TONE = {
  received: "neutral",
  inProgress: "info",
  resolved: "success",
  declined: "warning",
} as const satisfies Record<PublicState, string>;

export interface ThreadProps {
  locale: Locale;
  apiBase: string;
  projectKey: string;
  identity: string;
  requestId: string;
  /** The title the list already knows, shown while the thread loads. */
  title: string;
  /** The unread count over every request, as the API last said it. */
  onUnread: (count: number) => void;
  /** A team reply arrived in a request (the page hears `pulsarix:reply`). */
  onReply: (detail: { requestId: string }) => void;
  onBack: () => void;
}

const failure = (error: unknown): IntakeError =>
  error instanceof IntakeError ? error : new IntakeError("unknown", "unknown");

type Load =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; error: IntakeError };

/**
 * One request's thread (W3b), built on material's chat parts. Opening it marks it read; while
 * it is open the live stream (`GET /public/live/requests`, read with `fetch`) refreshes it, and
 * the stream stops on close. Replies carry files by the same ticket upload as a report.
 */
export default function Thread({
  locale,
  apiBase,
  projectKey,
  identity,
  requestId,
  title,
  onUnread,
  onReply,
  onBack,
}: ThreadProps) {
  const text = REQUESTS_MESSAGES[locale];
  const t = text.thread;
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const aborted = useRef(new AbortController());
  const seen = useRef<number | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  // The page's callbacks change on every render; the stream must not restart for that.
  const hear = useRef({ onUnread, onReply });
  hear.current = { onUnread, onReply };
  const call = { apiBase, publicKey: projectKey, identity, locale };

  /** Reads the thread; marks it read when team replies wait in it. */
  const read = useCallback(async () => {
    try {
      const next = await fetchRequest({
        apiBase,
        publicKey: projectKey,
        identity,
        locale,
        id: requestId,
        signal: aborted.current.signal,
      });
      if (aborted.current.signal.aborted) return;
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
        if (!aborted.current.signal.aborted) hear.current.onUnread(read.count);
      }
    } catch (error) {
      if (aborted.current.signal.aborted) return;
      setLoad({ status: "error", error: failure(error) });
    }
  }, [apiBase, projectKey, identity, locale, requestId]);

  // The thread is read on mount and the stream runs until it unmounts (close, back).
  useEffect(() => {
    const controller = new AbortController();
    aborted.current = controller;
    seen.current = null;
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
          else if (event.unread > 0)
            hear.current.onReply({ requestId: event.id });
        }
      },
    });
    return () => controller.abort();
  }, [apiBase, projectKey, identity, requestId, read]);

  const errorText = (error: IntakeError) => {
    if (error.code.endsWith("reopen-expired")) return t.errors.reopenExpired;
    if (error.code.endsWith("request-declined")) return t.errors.declined;
    if (error.kind === "files") return t.errors.files;
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
  };
  const [problem, setProblem] = useState<string | null>(null);

  const send = async (body: string, attached: File[]) => {
    setProblem(null);
    setNote(null);
    const trimmed = body.trim();
    if (!trimmed) return setProblem(t.needText);
    const oversize =
      attached.some(
        (f) => f.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.includes(f.type),
      ) || attached.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES;
    if (oversize) return setProblem(t.errors.files);
    setSending(true);
    try {
      const reply = await replyToRequest({
        ...call,
        id: requestId,
        body: trimmed,
        files: attached.map((file) => ({
          role: "file" as const,
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        signal: aborted.current.signal,
      });
      const failed: string[] = [];
      await Promise.all(
        attached.map(async (file, index) => {
          const ticket = reply.files[index];
          const result = ticket
            ? await putFile({
                apiBase,
                slot: ticket.slot,
                ticket: ticket.ticket,
                file,
                onProgress: () => {},
                signal: aborted.current.signal,
              })
            : { ok: false as const };
          if (!result.ok) failed.push(file.name);
        }),
      );
      if (aborted.current.signal.aborted) return;
      setValue("");
      setFiles([]);
      if (failed.length) setNote(t.filesFailed(failed.join(", ")));
      await read();
    } catch (error) {
      if (aborted.current.signal.aborted) return;
      setProblem(errorText(failure(error)));
    } finally {
      if (!aborted.current.signal.aborted) setSending(false);
    }
  };

  const change = async (action: typeof resolveRequest) => {
    setProblem(null);
    setActing(true);
    try {
      await action({ ...call, id: requestId, signal: aborted.current.signal });
      if (!aborted.current.signal.aborted) await read();
    } catch (error) {
      if (aborted.current.signal.aborted) return;
      const failed = failure(error);
      setProblem(errorText(failed));
      if (failed.code.endsWith("reopen-expired")) await read();
    } finally {
      if (!aborted.current.signal.aborted) setActing(false);
    }
  };

  const state = detail?.publicState;
  const declined = state === "declined";
  const resolved = state === "resolved";
  const items = detail
    ? [
        {
          id: "original",
          from: "reporter" as const,
          body: detail.description,
          at: detail.createdAt,
          files: detail.files,
        },
        ...detail.thread,
      ]
    : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{detail?.title ?? title}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          {state ? (
            <Badge variant="soft" tone={STATE_TONE[state]}>
              {text.states[state]}
            </Badge>
          ) : null}
          {detail ? date.format(new Date(detail.createdAt)) : null}
        </DialogDescription>
      </DialogHeader>
      <DialogBody role="region" aria-label={t.label}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
          {load.status === "loading" ? (
            <div role="status" aria-busy="true">
              <span className="sr-only">{t.loading}</span>
              <SkeletonText lines={4} labelled={false} />
            </div>
          ) : null}
          {load.status === "error" ? (
            <Alert
              variant="error"
              title={text.errors.title}
              description={errorText(load.error)}
            />
          ) : null}
          {declined ? (
            <Alert
              variant="warning"
              title={t.declinedTitle}
              description={detail?.declineReason || t.declinedNoReason}
            />
          ) : null}
          {resolved ? (
            <Alert
              variant="success"
              description={
                detail?.resolvedAt
                  ? t.resolvedNote(date.format(new Date(detail.resolvedAt)))
                  : text.states.resolved
              }
            />
          ) : null}
          {resolved && detail && !detail.canReopen ? (
            <Alert variant="info" description={t.reopenExpired} />
          ) : null}
          {problem ? (
            <Alert
              variant="error"
              title={t.errors.title}
              description={problem}
            />
          ) : null}
          {note ? <Alert variant="warning" description={note} /> : null}
          {detail ? (
            <NonceProvider nonce={pageNonce()}>
              <ChatThread
                surface="card"
                className="h-[min(460px,54dvh)]"
                messageListProps={{ itemCount: items.length + 1 }}
                composerProps={
                  detail.canReply
                    ? {
                        value,
                        onValueChange: setValue,
                        attachments: files,
                        onAttachmentsChange: setFiles,
                        onSend: (body, attached) => void send(body, attached),
                        isLoading: sending,
                        placeholder: t.placeholder,
                        sendLabel: t.send,
                        attachmentLabel: t.attach,
                        accept: ACCEPTED_TYPES.join(","),
                        maxFiles: 3,
                        maxLength: 4000,
                      }
                    : { disabled: true, disabledReason: t.readOnly }
                }
              >
                <ChatMessageSeparator
                  label={date.format(new Date(detail.createdAt))}
                />
                {items.map((message) => (
                  <ChatMessage
                    key={message.id}
                    variant={message.from === "reporter" ? "user" : "assistant"}
                    author={message.from === "reporter" ? t.you : t.team}
                    avatarFallback={t.team.charAt(0)}
                    timestamp={time.format(new Date(message.at))}
                    text={message.body}
                    footer={
                      message.files.length ? (
                        <ul
                          aria-label={t.attachments}
                          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
                        >
                          {message.files.map((file) => (
                            <li key={file.id}>
                              <Badge variant="soft">{file.name}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : undefined
                    }
                  />
                ))}
              </ChatThread>
            </NonceProvider>
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="tonal" onClick={onBack}>
          {t.back}
        </Button>
        {detail && !declined && !resolved ? (
          <Button
            type="button"
            loading={acting}
            onClick={() => void change(resolveRequest)}
          >
            {t.resolve}
          </Button>
        ) : null}
        {resolved && detail?.canReopen ? (
          <Button
            type="button"
            loading={acting}
            onClick={() => void change(reopenRequest)}
          >
            {t.reopen}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
