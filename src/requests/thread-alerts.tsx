import { Alert, SkeletonText } from "@softistx/material/embed";
import type { RequestDetail } from "./api";
import { threadErrorText } from "./error-text";
import type { RequestsMessages } from "./messages";
import type { Load } from "./use-thread";

/** The loading skeleton and every notice above a thread's messages. */
export function ThreadAlerts({
  text,
  load,
  detail,
  problem,
  note,
  formatDate,
}: {
  text: RequestsMessages;
  load: Load;
  detail: RequestDetail | null;
  problem: string | null;
  note: string | null;
  formatDate: (iso: string) => string;
}) {
  const t = text.thread;
  const state = detail?.publicState;
  const resolved = state === "resolved";
  return (
    <>
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
          description={threadErrorText(text, load.error)}
        />
      ) : null}
      {state === "declined" ? (
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
              ? t.resolvedNote(formatDate(detail.resolvedAt))
              : text.states.resolved
          }
        />
      ) : null}
      {resolved && detail && !detail.canReopen ? (
        <Alert variant="info" description={t.reopenExpired} />
      ) : null}
      {problem ? (
        <Alert variant="error" title={t.errors.title} description={problem} />
      ) : null}
      {note ? <Alert variant="warning" description={note} /> : null}
    </>
  );
}
