import type { Locale } from "../../../config";
import { fetchRequest, markRequestRead, type RequestDetail } from "../api";
import { teamCount } from "./thread-stream";

/**
 * One read of a thread: fetches it, hands it to `onDetail`, tells `onReply` when team replies
 * grew since `seen.current`, and marks it read (telling `onUnread` the new count) when replies
 * wait in it. Each step stops quietly once `current()` is false (an older read, an unmount).
 */
export async function readThread({
  call,
  requestId,
  signal,
  current,
  seen,
  hear,
  onDetail,
}: {
  call: {
    apiBase: string;
    publicKey: string;
    identity: string;
    locale: Locale;
  };
  requestId: string;
  signal: AbortSignal;
  current: () => boolean;
  seen: { current: number | null };
  hear: {
    current: {
      onUnread: (count: number) => void;
      onReply: (detail: { requestId: string }) => void;
    };
  };
  onDetail: (detail: RequestDetail) => void;
}): Promise<void> {
  const next = await fetchRequest({ ...call, id: requestId, signal });
  if (!current()) return;
  onDetail(next);
  const team = teamCount(next.thread);
  if (seen.current !== null && team > seen.current)
    hear.current.onReply({ requestId });
  seen.current = team;
  if (next.unread > 0) {
    const read = await markRequestRead({ ...call, id: requestId, signal });
    if (current()) hear.current.onUnread(read.count);
  }
}
