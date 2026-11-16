import {
  Button,
  Dialog,
  DialogContent,
  PortalContainerProvider,
} from "@softistx/material/embed";
import { useRef, useState } from "react";
import type { Locale, Position } from "./config";
import type { Messages } from "./messages";
import { ReportFlow } from "./report-flow";
import { themeNameFor } from "./theme";

// Temporary, until @softistx/material#4987
/**
 * On a phone the split dialog is one scrolling column: the body and the screenshot pane keep
 * their natural height instead of sharing a grid track that is shorter than the pane.
 */
const PHONE_STACK =
  "max-md:flex max-md:flex-col max-md:[&>[data-slot=dialog-body]]:flex-none max-md:[&>[data-slot=dialog-aside]]:flex-none";

export interface AppProps {
  /** The `data-nxgt-theme` scope the adopted theme CSS is declared under. */
  themeName?: string;
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  dark: boolean;
  open: boolean;
  launcher: boolean;
  position: Position;
  /** The screenshot's mask-text option starts on. */
  maskText?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (detail: { reportId: string }) => void;
  onError: (detail: { code: string }) => void;
  /** Specs only: the API's minimum fill time is waited out otherwise. */
  minFillMs?: number;
}

/**
 * The widget's tree. Its root element carries the theme scope and the dark class,
 * and is also the portal container: a dialog rendered into the shadow root itself
 * would sit outside the scope and lose the tokens.
 */
export function App({
  themeName = themeNameFor(null),
  messages,
  locale,
  projectKey,
  apiBase,
  dark,
  open,
  launcher,
  position,
  maskText = false,
  onOpenChange,
  onSubmitted,
  onError,
  minFillMs,
}: AppProps) {
  // The confirmation has no screenshot pane: the dialog drops its split layout then.
  const [done, setDone] = useState(false);
  // While the screenshot editor is open the pane widens: the editor needs more than a preview.
  const [editing, setEditing] = useState(false);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // Radix remembers `document.activeElement`, which a shadow host retargets to the host
  // itself: it cannot hand focus back to the launcher, so the launcher is kept here.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <div
      ref={setRoot}
      className={dark ? "pulsarix-root dark" : "pulsarix-root"}
      data-nxgt-theme={themeName}
      lang={locale}
    >
      {root ? (
        <PortalContainerProvider container={root}>
          {launcher ? (
            <div
              // Hidden, not unmounted, while the dialog is open: on a phone the dialog
              // covers the screen and a sliver of the launcher showed behind it, and the
              // button must stay so that focus can return to it on close.
              hidden={open}
              className={
                position === "bottom-left"
                  ? "fixed bottom-4 left-4 z-40"
                  : "fixed right-4 bottom-4 z-40"
              }
            >
              <Button
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  onOpenChange(true);
                }}
              >
                {messages.launcher}
              </Button>
            </div>
          ) : null}
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
              layout={done ? "stack" : "split"}
              size={done ? "md" : undefined}
              // About 896 px from 1280 px up (px, not rem: the host owns the root font size).
              className={
                done
                  ? undefined
                  : editing
                    ? `${PHONE_STACK} max-w-[1280px] lg:[--dialog-aside:560px] xl:[--dialog-aside:760px]`
                    : `${PHONE_STACK} max-w-[896px]`
              }
              onCloseAutoFocus={(event) => {
                if (!opener.current?.isConnected) return;
                event.preventDefault();
                opener.current.focus();
              }}
            >
              <ReportFlow
                messages={messages}
                locale={locale}
                projectKey={projectKey}
                apiBase={apiBase}
                onSubmitted={onSubmitted}
                onError={onError}
                minFillMs={minFillMs}
                maskText={maskText}
                onDone={setDone}
                onEditing={setEditing}
                onClose={() => onOpenChange(false)}
              />
            </DialogContent>
          </Dialog>
        </PortalContainerProvider>
      ) : null}
    </div>
  );
}
