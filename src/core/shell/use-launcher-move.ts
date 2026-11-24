import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { DEFAULT_PLACEMENT, type LauncherPlacement } from "../../config";
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
 * The tab's position along its edge: the saved fraction (or the host's starting point), the drag
 * (pointer) and the keyboard move (Alt+ArrowUp / Alt+ArrowDown), each move announced in a live
 * region. A drag never opens anything: `consumeDragClick()` is true once for the click that follows it.
 */
export function useLauncherMove({
  messages,
  placement = DEFAULT_PLACEMENT,
  onDragStart,
}: {
  messages: Messages;
  placement?: LauncherPlacement;
  /** Called when a press becomes a drag (the menu closes). */
  onDragStart: () => void;
}) {
  const height = useViewportHeight();
  // The reporter's own position wins over the host's starting point.
  const [saved, setSaved] = useState<number | null>(readSaved);
  const ratio = clamp01(saved ?? placement.offset);
  const top = topOf(ratio, height);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

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
    // Cancelling pointerdown also cancels the browser's focus, so the tab takes it itself.
    event.preventDefault();
    event.currentTarget.focus({ focusVisible: false } as FocusOptions);
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
      onDragStart();
    }
    setSaved(ratioOf(current.top + dy, height));
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    drag.current = null;
    if (!current?.moved) return;
    setDragging(false);
    // The click that follows the release is the drag's own: it must not open anything.
    // Cleared by the click itself, or by the next pointerdown or key press.
    justDragged.current = true;
    // From the release event itself: the last render may predate the last pointermove.
    const final = ratioOf(current.top + (event.clientY - current.y), height);
    setSaved(final);
    writeSaved(final);
    announce(final);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    justDragged.current = false;
    if (
      event.altKey &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      move(ratio + (event.key === "ArrowUp" ? -KEY_STEP : KEY_STEP));
    }
  };

  const consumeDragClick = () => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  };

  return {
    top,
    dragging,
    announcement,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
    },
    consumeDragClick,
  };
}
