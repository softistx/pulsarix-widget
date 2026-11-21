import { IntakeError } from "../../../core/api/api";
import type { LiveEvent } from "./live";

export interface StreamHearing {
  onUnread: (count: number) => void;
  onReply: (detail: { requestId: string }) => void;
}

/** The number of messages a thread holds from the team. */
export const teamCount = (thread: { from: string }[]): number =>
  thread.filter((m) => m.from === "team").length;

/** The thread's error code for a stream event that ends the stream (`expired`, `refused`). */
export const endCode = (event: {
  type: "expired" | "refused";
  status?: number;
}): string =>
  event.type === "expired"
    ? "intake.errors.identity-expired"
    : `http-${event.status}`;

/**
 * The live stream's event handler for one thread: the unread count is passed on, this thread's
 * update is re-read, another request's growing unread count is heard as a reply, and an ending
 * event (token expired or refused) is reported through `end`.
 */
export function threadStreamHandler({
  requestId,
  signal,
  heard,
  hear,
  read,
  end,
}: {
  requestId: string;
  signal: AbortSignal;
  /** The unread count last heard for each other request. */
  heard: Map<string, number>;
  hear: { current: StreamHearing };
  read: () => void;
  end: (code: string, error: IntakeError) => void;
}): (event: LiveEvent) => void {
  return (event) => {
    if (signal.aborted) return;
    if (event.type === "unread") return hear.current.onUnread(event.count);
    if (event.type === "updated") {
      if (event.id === requestId) return read();
      const before = heard.get(event.id) ?? 0;
      heard.set(event.id, event.unread);
      if (event.unread > before) hear.current.onReply({ requestId: event.id });
      return;
    }
    // The token expired (`expired`) or was refused (401, 403): the thread says so.
    const code = endCode(event);
    end(code, new IntakeError("identity", code));
  };
}
