import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
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

/*
 * Temporary, until @softistx/material#5651 (`/embed` exports `Icon` and the duotone sprites): the
 * menu's two icons are local SVGs meanwhile.
 * Temporary, until @softistx/material#5616 (`/embed` exports a Menu): `DropdownMenu` is only in the
 * main entry, +146 KB gzipped and no CSS in `embed.css`, so the menu below stays hand-made.
 */

/** A report icon, for the first entry of the menu. */
function ReportIcon() {
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
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </svg>
  );
}

/** A list icon, for "My requests". */
function RequestsIcon() {
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
      <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
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
  const box = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
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
    } else if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      setMenuOpen(false);
    } else if (event.key === "ArrowDown" && identified && !menuOpen) {
      event.preventDefault();
      setMenuOpen(true);
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
    setMenuOpen(false);
    action();
  };

  // The menu takes focus when it opens, and gives it back to the tab on close unless a choice opened
  // the dialog. A click outside closes it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (menuOpen) {
      menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    } else if (wasOpen.current) {
      if (chose.current) chose.current = false;
      else fabRef.current?.focus();
    }
    wasOpen.current = menuOpen;
  }, [menuOpen, fabRef]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    if (!menuOpen) return;
    const root = box.current?.getRootNode() as
      | Document
      | ShadowRoot
      | undefined;
    const outside = (event: Event) => {
      if (!event.composedPath().includes(box.current as EventTarget))
        closeMenu();
    };
    root?.addEventListener("pointerdown", outside);
    document.addEventListener("pointerdown", outside);
    return () => {
      root?.removeEventListener("pointerdown", outside);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menuOpen, closeMenu]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"),
    ];
    const at = items.indexOf(event.target as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(at + delta + items.length) % items.length]?.focus();
    }
  };

  const name =
    unread > 0
      ? `${messages.launcher}, ${messages.launcherUnread(unread)}`
      : messages.launcher;
  const hintId = `${menuId}-hint`;
  const keyHintId = `${menuId}-keyhint`;

  return (
    <div
      ref={box}
      hidden={open || !visible}
      data-launcher="tab"
      data-side={side}
      data-dragging={dragging || undefined}
      className="pulsarix-tab"
      style={{ top }}
    >
      <button
        ref={fabRef}
        type="button"
        className="pulsarix-tab-button"
        aria-label={name}
        aria-describedby={`${hintId} ${keyHintId}`}
        aria-expanded={identified ? menuOpen : open}
        aria-controls={identified ? (menuOpen ? menuId : undefined) : dockId}
        aria-haspopup={identified ? "menu" : undefined}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onClick={onClick}
      >
        <PulseMark />
        {/* The count moves to "My requests" while the menu is open: shown once, never twice. */}
        {unread > 0 && !(identified && menuOpen) ? (
          <span className="pulsarix-tab-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        <span className="pulsarix-tab-tip" aria-hidden="true" data-tip>
          <strong>{messages.launcher}</strong>
          <small data-hint="drag">{messages.launcherHint}</small>
          <small data-hint="key">{messages.launcherKeyHint}</small>
        </span>
      </button>
      <span id={hintId} className="pulsarix-sr">
        {messages.launcherHint}
      </span>
      <span id={keyHintId} className="pulsarix-sr">
        {messages.launcherKeyHint}
      </span>
      <span role="status" aria-live="polite" className="pulsarix-sr">
        {announcement}
      </span>
      {identified && menuOpen ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={messages.launcher}
          className="pulsarix-tab-menu"
          data-below={top < height / 2 ? "true" : "false"}
          onKeyDown={onMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="pulsarix-tab-item"
            onClick={() => choose(onReport)}
          >
            <ReportIcon />
            <span>{messages.title}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="pulsarix-tab-item"
            onClick={() => choose(onRequests)}
          >
            <RequestsIcon />
            <span>{messages.myRequests}</span>
            {unread > 0 ? (
              <span className="pulsarix-tab-count">{unread}</span>
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
}
