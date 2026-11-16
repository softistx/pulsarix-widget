import {
  Button,
  Dialog,
  DialogContent,
  I18nProvider,
  PortalContainerProvider,
} from "@softistx/material/embed";
import { useRef, useState } from "react";
import type { Locale, Position } from "./config";
import type { Messages } from "./messages";
import { ReportFlow, type SubmitDetail } from "./report-flow";
import { themeNameFor } from "./theme";

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
  /** `data-attachments="false"` hides the screenshot pane and the files. */
  attachments?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (detail: SubmitDetail) => void;
  onError: (detail: { code: string }) => void;
  /** Specs only: the API's minimum fill time is waited out otherwise. */
  minFillMs?: number;
  /** Specs only: the wait before an upload's one retry. */
  retryDelayMs?: number;
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
  attachments = true,
  onOpenChange,
  onSubmitted,
  onError,
  minFillMs,
  retryDelayMs,
}: AppProps) {
  // The confirmation has no screenshot pane: the dialog drops its split layout then.
  const [done, setDone] = useState(false);
  // Without the screenshot pane and files (the page or the key turned them off) it is one column too.
  const [controls, setControls] = useState(attachments);
  const stacked = done || !controls;
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
        // `/embed` carries its own i18n context (the `AttachmentList` labels); `initialLanguage`
        // keeps it from reading the host page's `localStorage`.
        <I18nProvider
          // Keyed: the provider reads `initialLanguage` once, a changed `locale` attribute remounts it.
          key={locale}
          initialLanguage={locale}
          supportedLanguages={["en", "fr"]}
          defaultLanguage={locale}
        >
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
                layout={stacked ? "stack" : "split"}
                size={stacked ? "md" : undefined}
                // About 896 px from 1280 px up (px, not rem: the host owns the root font size).
                className={
                  stacked
                    ? undefined
                    : editing
                      ? "max-w-[1280px] lg:[--dialog-aside:560px]! xl:[--dialog-aside:760px]!"
                      : "max-w-[896px]"
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
                  retryDelayMs={retryDelayMs}
                  maskText={maskText}
                  onDone={setDone}
                  onEditing={setEditing}
                  attachments={attachments}
                  onControls={setControls}
                  onClose={() => onOpenChange(false)}
                />
              </DialogContent>
            </Dialog>
          </PortalContainerProvider>
        </I18nProvider>
      ) : null}
    </div>
  );
}
