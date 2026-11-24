import { CountBadge } from "@softistx/material/embed";
import { type RefObject, useId, useState } from "react";
import {
  DEFAULT_PLACEMENT,
  type LauncherPlacement,
  type LauncherSide,
} from "../../config";
import type { Messages } from "../messages";
import { LauncherMenu } from "./launcher-menu";
import { useLauncherMove } from "./use-launcher-move";

/**
 * The pulsarix mark, a pulse line, as an inline SVG in `currentColor`: it takes the theme's primary
 * foreground through the tab. The button's accessible name is the label, so the mark is decorative.
 */
function PulseMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12.8h5l2-5.6 3.8 9.6 2-4h5.2" />
    </svg>
  );
}

/**
 * Temporary, until @softistx/material#5672 (a docked launcher component): hand-made from a button,
 * CountBadge and DropdownMenu meanwhile.
 *
 * The launcher: a 44 px icon button docked flush to the viewport edge (an edge tab), with corners on the
 * content side only, wearing the pulsarix mark and the unread count. Its label is a tooltip only
 * (hover or keyboard focus, hidden while dragging and on touch screens); its accessible name carries
 * the count ("Report a problem, 2 unread requests").
 *
 * The host chooses the starting edge and height (`placement`). The reporter moves it along the edge by
 * dragging, or with Alt+ArrowUp / Alt+ArrowDown (each move announced in a live region); the fraction
 * is clamped inside the viewport, kept when it resizes, and saved in `localStorage` per host origin.
 * A drag never opens anything: only a click, Enter or Space does.
 *
 * A reporter with no identity has one task, so the tab opens the report form; an identified one has
 * two, so it opens a small menu beside the tab: "Report a problem" and "My requests" (with its unread
 * badge). Escape and a click outside close the menu, and focus goes back to the tab.
 *
 * It is hidden, not unmounted, while the dialog is open, so focus can return to it on close.
 * `visible={false}` (the host's `setLauncherVisible`) hides it the same way, never the dialog.
 */
export function Launcher({
  messages,
  placement = DEFAULT_PLACEMENT,
  visible = true,
  open,
  unread,
  identified,
  fabRef,
  dockId,
  onReport,
  onRequests,
}: {
  messages: Messages;
  placement?: LauncherPlacement;
  visible?: boolean;
  open: boolean;
  unread: number;
  /** Whether the reporter is identified: only then is there a second entry, "My requests". */
  identified: boolean;
  /** The tab, which the app keeps to hand focus back on close. */
  fabRef: RefObject<HTMLButtonElement | null>;
  /** The id of the dialog the tab opens (`aria-controls` for a reporter with one task). */
  dockId?: string;
  onReport: () => void;
  onRequests: () => void;
}) {
  const side: LauncherSide = placement.side;
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const move = useLauncherMove({
    messages,
    placement,
    onDragStart: () => setMenuOpen(false),
  });

  const onClick = () => {
    if (move.consumeDragClick()) return;
    if (identified) setMenuOpen((value) => !value);
    else onReport();
  };

  // An identified reporter's tab opens a menu, so its name says so.
  const label = identified ? messages.launcherMenu : messages.launcher;
  const name =
    unread > 0 ? `${label}, ${messages.launcherUnread(unread)}` : label;
  const hintId = `${menuId}-hint`;
  const keyHintId = `${menuId}-keyhint`;

  const button = (
    <button
      ref={fabRef}
      type="button"
      className="pulsarix-tab-button"
      aria-label={name}
      aria-describedby={`${hintId} ${keyHintId}`}
      aria-expanded={identified ? menuOpen : open}
      aria-controls={identified ? undefined : dockId}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      {...move.handlers}
      onClick={onClick}
    >
      {/* The count moves to "My requests" while the menu is open: shown once, never twice. */}
      <CountBadge
        count={identified && menuOpen ? 0 : unread}
        placement={side === "right" ? "top-start" : "top-end"}
        announce={false}
        animated
      >
        <span className="pulsarix-tab-face">
          <PulseMark />
        </span>
      </CountBadge>
      {/* Temporary, until @softistx/material#5670 (Tooltip in /embed): a CSS-only tooltip meanwhile. */}
      <span className="pulsarix-tab-tip" aria-hidden="true" data-tip>
        <strong>{label}</strong>
        <small data-hint="drag">{messages.launcherHint}</small>
        <small data-hint="key">{messages.launcherKeyHint}</small>
      </span>
    </button>
  );

  return (
    <div
      hidden={open || !visible}
      data-launcher="tab"
      data-side={side}
      data-dragging={move.dragging || undefined}
      className="pulsarix-tab"
      style={{ top: move.top }}
    >
      {identified ? (
        <LauncherMenu
          messages={messages}
          side={side}
          label={label}
          unread={unread}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          trigger={button}
          onReport={onReport}
          onRequests={onRequests}
        />
      ) : (
        button
      )}
      <span id={hintId} className="pulsarix-sr">
        {messages.launcherHint}
      </span>
      <span id={keyHintId} className="pulsarix-sr">
        {messages.launcherKeyHintSpoken}
      </span>
      <span role="status" aria-live="polite" className="pulsarix-sr">
        {move.announcement}
      </span>
    </div>
  );
}
