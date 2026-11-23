import { Fab, FabMenu } from "@softistx/material/embed";
import { type CSSProperties, type RefObject, useRef, useState } from "react";
import type { Position } from "../../config";
import type { Messages } from "../messages";

/**
 * The pulsarix mark, a pulse line, as an inline SVG in `currentColor`: it takes the theme's primary
 * through the FAB. The button's accessible name is the label, so the mark is decorative.
 */
function PulseMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12.8h5l2-5.6 3.8 9.6 2-4h5.2" />
    </svg>
  );
}

/** A plus: material turns the open FAB's icon by 45 degrees, so a plus becomes the close cross. */
function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

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

/**
 * The floating launcher: one round FAB at every width, wearing the pulsarix mark and the unread count
 * (in its accessible name too). A reporter with no identity has one task, so the FAB opens the report
 * form; an identified one has two, so it opens a menu anchored to the FAB: "Report a problem" and
 * "My requests" (with its unread badge). Escape and a click outside close the menu, and focus goes back
 * to the FAB.
 *
 * It is hidden, not unmounted, while the dialog is open (on a phone the dialog covers the screen), and
 * the button stays so that focus can return to it on close. `visible={false}` (the host's
 * `setLauncherVisible`) hides it the same way, never the dialog.
 *
 * Its distances come from `--pulsarix-launcher-bottom` and `--pulsarix-launcher-side` (16 px by
 * default), set on the host element by the `offset` option or by the host's own CSS; the bottom one is
 * raised by the device's safe area.
 */
export function Launcher({
  messages,
  position,
  visible = true,
  open,
  unread,
  identified,
  fabRef,
  onReport,
  onRequests,
}: {
  messages: Messages;
  position: Position;
  visible?: boolean;
  open: boolean;
  unread: number;
  /** Whether the reporter is identified: only then is there a second entry, "My requests". */
  identified: boolean;
  /** The FAB, which the app keeps to hand focus back on close. */
  fabRef: RefObject<HTMLButtonElement | null>;
  onReport: () => void;
  onRequests: () => void;
}) {
  // A choice opens the dialog, which takes focus: the menu must not pull it back onto the (hidden) FAB.
  const chose = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      hidden={open || !visible}
      data-launcher="fab"
      style={{ "--nxgt-fab-radius": "9999px" } as CSSProperties}
      className={`fixed z-40 bottom-[calc(var(--pulsarix-launcher-bottom,16px)+env(safe-area-inset-bottom,0px))] ${
        position === "bottom-left"
          ? "left-(--pulsarix-launcher-side,16px)"
          : "right-(--pulsarix-launcher-side,16px)"
      }`}
    >
      {identified ? (
        <FabMenu
          ref={fabRef}
          label={messages.launcher}
          variant="filled"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          count={menuOpen ? 0 : unread}
          icon={menuOpen ? <PlusIcon /> : <PulseMark />}
          onCloseAutoFocus={(event) => {
            if (!chose.current) return;
            chose.current = false;
            event.preventDefault();
          }}
          items={[
            {
              id: "report",
              icon: <ReportIcon />,
              label: messages.title,
              onSelect: () => {
                chose.current = true;
                onReport();
              },
            },
            {
              id: "requests",
              icon: <RequestsIcon />,
              label: messages.myRequests,
              badge: unread,
              onSelect: () => {
                chose.current = true;
                onRequests();
              },
            },
          ]}
        />
      ) : (
        <Fab
          ref={fabRef}
          label={messages.launcher}
          variant="filled"
          count={unread}
          icon={<PulseMark />}
          onClick={onReport}
        />
      )}
    </div>
  );
}
