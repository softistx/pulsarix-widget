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
import { THEME_NAME } from "./theme";

export interface AppProps {
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  dark: boolean;
  open: boolean;
  launcher: boolean;
  position: Position;
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
  messages,
  locale,
  projectKey,
  apiBase,
  dark,
  open,
  launcher,
  position,
  onOpenChange,
  onSubmitted,
  onError,
  minFillMs,
}: AppProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // Radix remembers `document.activeElement`, which a shadow host retargets to the host
  // itself: it cannot hand focus back to the launcher, so the launcher is kept here.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <div
      ref={setRoot}
      className={dark ? "pulsarix-root dark" : "pulsarix-root"}
      data-nxgt-theme={THEME_NAME}
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
              size="md"
              className="flex flex-col overflow-hidden"
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
                onClose={() => onOpenChange(false)}
              />
            </DialogContent>
          </Dialog>
        </PortalContainerProvider>
      ) : null}
    </div>
  );
}
