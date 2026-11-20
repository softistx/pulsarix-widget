import { DialogBody } from "@softistx/material/embed";
import type { Locale } from "../config";
import { reopenRequest, resolveRequest } from "./api";
import { REQUESTS_MESSAGES } from "./messages";
import { ThreadAlerts } from "./thread-alerts";
import { ThreadChat } from "./thread-chat";
import { ThreadFooter, ThreadHeader } from "./thread-frame";
import { useReply } from "./use-reply";
import { useThread } from "./use-thread";

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
  /** The token was refused or expired (the page hears `pulsarix:error`). */
  onError: (detail: { code: string }) => void;
  onBack: () => void;
}

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
  onError,
  onBack,
}: ThreadProps) {
  const text = REQUESTS_MESSAGES[locale];
  const t = text.thread;
  const ids = { locale, apiBase, projectKey, identity, requestId };
  const { detail, load, read, aborted } = useThread({
    ...ids,
    onUnread,
    onReply,
    onError,
  });
  const reply = useReply({ ...ids, text, read, aborted });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const time = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const formatDate = (iso: string) => date.format(new Date(iso));

  return (
    <>
      <ThreadHeader
        text={text}
        detail={detail}
        title={title}
        formatDate={formatDate}
      />
      <DialogBody role="region" aria-label={t.label}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
          <ThreadAlerts
            text={text}
            load={load}
            detail={detail}
            problem={reply.problem}
            note={reply.note}
            formatDate={formatDate}
          />
          {detail ? (
            <ThreadChat
              text={text}
              detail={detail}
              formatDate={formatDate}
              formatTime={(iso) => time.format(new Date(iso))}
              composer={{
                value: reply.value,
                onValueChange: reply.setValue,
                files: reply.files,
                onFilesChange: reply.setFiles,
                onSend: (body, attached) => void reply.send(body, attached),
                sending: reply.sending,
              }}
            />
          ) : null}
        </div>
      </DialogBody>
      <ThreadFooter
        text={text}
        detail={detail}
        acting={reply.acting}
        onBack={onBack}
        onResolve={() => void reply.change(resolveRequest)}
        onReopen={() => void reply.change(reopenRequest)}
      />
    </>
  );
}
