import { Badge, Button } from "@softistx/material/embed";
import type { Position } from "../../config";
import type { Messages } from "../messages";

/** The unread count the launcher shows, "99+" past 99. */
const count = (unread: number) => (unread > 99 ? "99+" : unread);

/**
 * The floating launcher button, with the unread badge. It is hidden, not unmounted, while the
 * dialog is open: on a phone the dialog covers the screen and a sliver of the launcher showed
 * behind it, and the button must stay so that focus can return to it on close.
 */
export function Launcher({
  messages,
  position,
  open,
  unread,
  onOpen,
}: {
  messages: Messages;
  position: Position;
  open: boolean;
  unread: number;
  /** Called with the button, which the app keeps to hand focus back on close. */
  onOpen: (button: HTMLElement) => void;
}) {
  return (
    <div
      hidden={open}
      className={
        position === "bottom-left"
          ? "fixed bottom-4 left-4 z-40"
          : "fixed right-4 bottom-4 z-40"
      }
    >
      <Button onClick={(event) => onOpen(event.currentTarget)}>
        {messages.launcher}
        {unread > 0 ? (
          <span className="sr-only">{messages.unreadReplies(unread)}</span>
        ) : null}
      </Button>
      {unread > 0 ? (
        <Badge
          aria-hidden="true"
          variant="error"
          className="pointer-events-none absolute -top-2 -right-2"
        >
          {count(unread)}
        </Badge>
      ) : null}
    </div>
  );
}
