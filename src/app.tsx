import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  I18nProvider,
  PortalContainerProvider,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@softistx/material/embed";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { WidgetProject } from "./api";
import type { Locale, MetadataEntry, Position } from "./config";
import type { Messages } from "./messages";
import { ReportFlow, type SubmitDetail } from "./report-flow";
import { useUnread } from "./requests/use-unread";
import { themeNameFor } from "./theme";
import type { ReportValues } from "./validation";

// "My requests" is its own chunk: a reporter with no identity never downloads it.
const loadRequests = () => import("./requests/panel");
const RequestsPanel = lazy(loadRequests);

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
  /** Starting values of the form (`prefill-email`, `prefill-title`). */
  prefill?: { email: string; title: string };
  /** Flat strings stored with each report. */
  metadata?: MetadataEntry[];
  /** The integrator's privacy page, linked in the privacy line. */
  privacyUrl?: string | null;
  /** The host's signed identity token; with it the dialog has New request and My requests tabs. */
  identity?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (detail: SubmitDetail) => void;
  /** A team reply arrived (`pulsarix:reply`), heard while a thread is open. */
  onReply?: (detail: { requestId: string }) => void;
  /** "Delete my data" erased the reporter's requests (`pulsarix:erase`). */
  onErase?: (detail: { requests: number }) => void;
  /** The unread count changed (`pulsarix:unread`). */
  onUnreadChange?: (detail: { count: number }) => void;
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
  prefill,
  metadata,
  privacyUrl,
  identity = null,
  onOpenChange,
  onSubmitted,
  onReply,
  onUnreadChange,
  onErase,
  onError,
  minFillMs,
  retryDelayMs,
}: AppProps) {
  // The confirmation has no screenshot pane: the dialog drops its split layout then.
  const [done, setDone] = useState(false);
  // Without the screenshot pane and files (the page or the key turned them off) it is one column too.
  const [controls, setControls] = useState(attachments);
  // While the screenshot editor is open the pane widens: the editor needs more than a preview.
  const [editing, setEditing] = useState(false);
  // The key's config survives a tab switch (the form remounts), not a close.
  const [project, setProject] = useState<WidgetProject | null>(null);
  const identified = !!identity && !!projectKey && !!apiBase;
  const [tab, setTab] = useState<"new" | "requests">("new");
  const showing = identified ? tab : "new";
  // The list is one column, like the confirmation.
  const stacked = done || !controls || showing === "requests";
  const [unread, setUnread] = useUnread({
    apiBase,
    projectKey,
    identity,
    locale,
    open,
  });
  const announced = useRef(0);
  useEffect(() => {
    if (unread === announced.current) return;
    announced.current = unread;
    onUnreadChange?.({ count: unread });
  }, [unread, onUnreadChange]);
  // The list's chunk is fetched as soon as an identified reporter opens the dialog.
  useEffect(() => {
    if (open && identified) void loadRequests();
  }, [open, identified]);
  // A dialog opens on the form; the list is one tab away.
  useEffect(() => {
    if (!open) {
      setTab("new");
      setProject(null);
    }
  }, [open]);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // Radix remembers `document.activeElement`, which a shadow host retargets to the host
  // itself: it cannot hand focus back to the launcher, so the launcher is kept here.
  const opener = useRef<HTMLElement | null>(null);
  // The typed text outlives the dialog (its content unmounts on close): a close by accident,
  // a click outside or Escape, keeps it for the next opening. A sent report clears it.
  const draft = useRef<ReportValues | null>(null);
  const tabs = (
    <TabsList aria-label={messages.tabs.label}>
      <TabsTrigger value="new">{messages.tabs.newRequest}</TabsTrigger>
      <TabsTrigger value="requests">
        {messages.tabs.myRequests}
        {unread > 0 ? (
          <Badge size="sm" variant="error" className="ml-1.5">
            {unread > 99 ? "99+" : unread}
            <span className="sr-only"> {messages.unreadReplies(unread)}</span>
          </Badge>
        ) : null}
      </TabsTrigger>
    </TabsList>
  );
  const body = (
    <>
      {showing === "requests" && identity ? (
        <Suspense
          fallback={
            <>
              <DialogHeader>
                <DialogTitle>{messages.title}</DialogTitle>
                {tabs}
              </DialogHeader>
              <DialogBody>{null}</DialogBody>
            </>
          }
        >
          <RequestsPanel
            messages={messages}
            locale={locale}
            apiBase={apiBase}
            projectKey={projectKey}
            identity={identity}
            headerExtra={tabs}
            onUnread={setUnread}
            onReply={onReply}
            onErase={onErase}
            onClose={() => onOpenChange(false)}
            onNewRequest={() => {
              setEditing(false);
              setTab("new");
            }}
          />
        </Suspense>
      ) : (
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
          prefill={prefill}
          metadata={metadata}
          privacyUrl={privacyUrl}
          draft={draft}
          identity={identity}
          headerExtra={identified ? tabs : undefined}
          project={project}
          onProject={setProject}
          onControls={setControls}
          onClose={() => onOpenChange(false)}
        />
      )}
    </>
  );
  const content = identified ? (
    <Tabs
      value={showing}
      activationMode="manual"
      onValueChange={(value) => {
        // The form unmounts with its screenshot: the editor is closed with it.
        setEditing(false);
        setTab(value === "requests" ? "requests" : "new");
      }}
      // No box of its own: the dialog's header, body and footer stay its grid items.
      className="contents"
    >
      {body}
    </Tabs>
  ) : (
    body
  );

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
          // Keyed: the provider reads `initialLanguage` once, a changed `locale` attribute remounts the tree (a rare edge; the host sets it once).
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
                  {unread > 0 ? (
                    <span className="sr-only">
                      {messages.unreadReplies(unread)}
                    </span>
                  ) : null}
                </Button>
                {unread > 0 ? (
                  <Badge
                    aria-hidden="true"
                    variant="error"
                    className="pointer-events-none absolute -top-2 -right-2"
                  >
                    {unread > 99 ? "99+" : unread}
                  </Badge>
                ) : null}
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
                {content}
              </DialogContent>
            </Dialog>
          </PortalContainerProvider>
        </I18nProvider>
      ) : null}
    </div>
  );
}
