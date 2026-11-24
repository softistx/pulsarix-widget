import {
  CountBadge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@softistx/material/embed";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_PLACEMENT,
  type LauncherPlacement,
  type LauncherSide,
} from "../../config";
import type { Messages } from "../messages";
import {
  clamp01,
  DRAG_THRESHOLD,
  KEY_STEP,
  ratioOf,
  readSaved,
  topOf,
  writeSaved,
} from "./launcher-position";

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

/** The viewport's height, followed on resize so the tab stays inside it. */
function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/**
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
  const height = useViewportHeight();
  // The reporter's own position wins over the host's starting point.
  const [saved, setSaved] = useState<number | null>(readSaved);
  const ratio = clamp01(saved ?? placement.offset);
  const top = topOf(ratio, height);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  // A choice opens the dialog, which takes focus: the menu must not pull it back onto the tab.
  const chose = useRef(false);

  const announce = (value: number) => {
    // Emptied first so a repeated value is announced again.
    setAnnouncement("");
    setTimeout(
      () => setAnnouncement(messages.launcherMoved(Math.round(value * 100))),
      30,
    );
  };

  const move = (to: number) => {
    const next = clamp01(to);
    setSaved(next);
    writeSaved(next);
    announce(next);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    justDragged.current = false;
    if (event.button !== 0) return;
    // The menu opens on click, never on pointerdown, so a drag along the edge cannot open it.
    event.preventDefault();
    drag.current = { y: event.clientY, top, moved: false };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every environment can capture a pointer.
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const dy = event.clientY - current.y;
    if (!current.moved && Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
      setMenuOpen(false);
    }
    setSaved(ratioOf(current.top + dy, height));
  };
  const endDrag = () => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    setDragging(false);
    // The click that follows the release is the drag's own: it must not open anything.
    // Cleared by the click itself, or by the next pointerdown or key press.
    justDragged.current = true;
    const final = clamp01(saved ?? placement.offset);
    writeSaved(final);
    announce(final);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    justDragged.current = false;
    if (
      event.altKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      move(ratio + (event.key === "ArrowUp" ? -KEY_STEP : KEY_STEP));
    }
  };

  const onClick = () => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (identified) setMenuOpen((value) => !value);
    else onReport();
  };

  const choose = (action: () => void) => {
    chose.current = true;
    action();
  };

  const name =
    unread > 0
      ? `${messages.launcher}, ${messages.launcherUnread(unread)}`
      : messages.launcher;
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {/* The count moves to "My requests" while the menu is open: shown once, never twice. */}
      <CountBadge
        count={identified && menuOpen ? 0 : unread}
        placement="top-start"
        announce={false}
        animated
      >
        <PulseMark />
      </CountBadge>
      <span className="pulsarix-tab-tip" aria-hidden="true" data-tip>
        <strong>{messages.launcher}</strong>
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
      data-dragging={dragging || undefined}
      className="pulsarix-tab"
      style={{ top }}
    >
      {identified ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
          <DropdownMenuContent
            side={side === "right" ? "left" : "right"}
            align="start"
            sideOffset={10}
            collisionPadding={8}
            aria-label={messages.launcher}
            onCloseAutoFocus={(event) => {
              // A choice opens the dialog, which takes focus: the menu must not pull it back.
              if (chose.current) {
                chose.current = false;
                event.preventDefault();
              }
            }}
          >
            <DropdownMenuItem
              className="pulsarix-tab-item"
              onSelect={() => choose(onReport)}
            >
              <Icon
                name="triangle-exclamation"
                className="size-5"
                aria-hidden="true"
              />
              <span>{messages.title}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="pulsarix-tab-item"
              onSelect={() => choose(onRequests)}
            >
              <Icon name="list-ul" className="size-5" aria-hidden="true" />
              <span>{messages.myRequests}</span>
              {unread > 0 ? (
                <span className="pulsarix-tab-count">{unread}</span>
              ) : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        {announcement}
      </span>
    </div>
  );
}
