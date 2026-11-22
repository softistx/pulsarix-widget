import { Badge, Button } from "@softistx/material/embed";
import { useSyncExternalStore } from "react";
import type { LauncherMode, Position } from "../../config";
import type { Messages } from "../messages";

/** The unread count the launcher shows, "99+" past 99. */
const count = (unread: number) => (unread > 99 ? "99+" : unread);

/** Below this viewport width (px) the `auto` launcher is the icon. */
export const COMPACT_BELOW = 640;
const COMPACT_QUERY = `(max-width: ${COMPACT_BELOW - 1}px)`;

const subscribe = (notify: () => void) => {
  const list = window.matchMedia?.(COMPACT_QUERY);
  list?.addEventListener("change", notify);
  return () => list?.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia?.(COMPACT_QUERY).matches ?? false;

/** Whether the viewport is narrower than 640 px, live: the listener follows a resize or a rotation. */
function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** A speech bubble; the button's accessible name is the label, so the icon is decorative. */
function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/**
 * The floating launcher button, with the unread badge. It is hidden, not unmounted, while the
 * dialog is open: on a phone the dialog covers the screen and a sliver of the launcher showed
 * behind it, and the button must stay so that focus can return to it on close. `visible={false}`
 * (the host's `setLauncherVisible`) hides it the same way, never the dialog.
 *
 * Its distances come from `--pulsarix-launcher-bottom` and `--pulsarix-launcher-side` (16 px by
 * default), set on the host element by the `offset` option or by the host's own CSS; the bottom
 * one is raised by the device's safe area.
 */
export function Launcher({
  messages,
  position,
  mode = "auto",
  visible = true,
  open,
  unread,
  onOpen,
}: {
  messages: Messages;
  position: Position;
  mode?: LauncherMode;
  visible?: boolean;
  open: boolean;
  unread: number;
  /** Called with the button, which the app keeps to hand focus back on close. */
  onOpen: (button: HTMLElement) => void;
}) {
  const narrow = useCompactViewport();
  const icon = mode === "icon" || (mode === "auto" && narrow);
  const unreadText = unread > 0 ? messages.unreadReplies(unread) : null;
  return (
    <div
      hidden={open || !visible}
      data-launcher={icon ? "icon" : "pill"}
      className={`fixed z-40 bottom-[calc(var(--pulsarix-launcher-bottom,16px)+env(safe-area-inset-bottom,0px))] ${
        position === "bottom-left"
          ? "left-(--pulsarix-launcher-side,16px)"
          : "right-(--pulsarix-launcher-side,16px)"
      }`}
    >
      {icon ? (
        <Button
          size="icon-lg"
          title={messages.launcher}
          aria-label={
            unreadText
              ? `${messages.launcher}, ${unreadText}`
              : messages.launcher
          }
          className="size-[48px] shrink-0 focus-visible:ring-[3px]"
          onClick={(event) => onOpen(event.currentTarget)}
        >
          <ChatIcon />
          {unreadText ? <span className="sr-only">{unreadText}</span> : null}
        </Button>
      ) : (
        <Button onClick={(event) => onOpen(event.currentTarget)}>
          {messages.launcher}
          {unreadText ? <span className="sr-only">{unreadText}</span> : null}
        </Button>
      )}
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
