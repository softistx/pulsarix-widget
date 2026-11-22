import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  I18nProvider,
  PortalContainerProvider,
} from "@softistx/material/embed";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { AppProps } from "./app-props";
import { DialogTabs } from "./core/shell/dialog-tabs";
import { Launcher } from "./core/shell/launcher";
import { themeNameFor } from "./core/theme/theme";
import type { WidgetProject } from "./modules/report/api";
import { ReportFlow } from "./modules/report/components/report-flow";
import type { ReportValues } from "./modules/report/model/validation";
import { useUnread } from "./modules/requests/hooks/use-unread";

// "My requests" is its own chunk: a reporter with no identity never downloads it.
const loadRequests = () => import("./modules/requests/components/panel");
const RequestsPanel = lazy(loadRequests);

export type { AppProps } from "./app-props";

/**
 * The widget's tree. Its root element carries the theme scope and the dark class,
 * and is also the portal container: a dialog rendered into the shadow root itself
 * would sit outside the scope and lose the tokens.
 */
export function App({
  themeName = themeNameFor(null),
  hostTokens,
  messages,
  locale,
  projectKey,
  apiBase,
  dark,
  open,
  launcher,
  launcherMode = "auto",
  launcherVisible = true,
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
  // A report is on its way: the language of material's own labels must not be re-keyed now.
  const [submitting, setSubmitting] = useState(false);
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
  // Temporary, until nxgt-material#5476 (the embed `I18nProvider` follows a language change).
  // The provider reads its language once, so a new one re-keys the tree and the flow loses its
  // state. The widget's own strings follow `locale` at once; material's built-in labels (the
  // dialog's close button, the file list) follow `i18nLocale`, which waits until nothing would
  // be lost: no report on its way, no confirmation, no requests list. A closed dialog has nothing.
  const idle = !open || (!submitting && !done && showing === "new");
  const [i18nLocale, setI18nLocale] = useState(locale);
  useEffect(() => {
    if (idle) setI18nLocale(locale);
  }, [idle, locale]);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // Radix remembers `document.activeElement`, which a shadow host retargets to the host
  // itself: it cannot hand focus back to the launcher, so the launcher is kept here.
  const opener = useRef<HTMLElement | null>(null);
  // The typed text outlives the dialog (its content unmounts on close): a close by accident,
  // a click outside or Escape, keeps it for the next opening. A sent report clears it.
  const draft = useRef<ReportValues | null>(null);
  const tabs = (
    <DialogTabs
      messages={messages}
      unread={unread}
      value={showing}
      onValueChange={(next) => {
        // The form unmounts with its screenshot: the editor is closed with it.
        setEditing(false);
        setTab(next);
      }}
    />
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
            onError={onError}
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
          onSubmitting={setSubmitting}
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
  return (
    <div
      ref={setRoot}
      className={dark ? "pulsarix-root dark" : "pulsarix-root"}
      data-nxgt-theme={themeName}
      style={hostTokens}
      lang={locale}
    >
      {root ? (
        // `/embed` carries its own i18n context (the `AttachmentList` labels); `initialLanguage`
        // keeps it from reading the host page's `localStorage`.
        <I18nProvider
          // Keyed: the provider reads `initialLanguage` once (see `i18nLocale`).
          key={i18nLocale}
          initialLanguage={i18nLocale}
          supportedLanguages={["en", "fr"]}
          defaultLanguage={i18nLocale}
        >
          <PortalContainerProvider container={root}>
            {launcher ? (
              <Launcher
                messages={messages}
                position={position}
                mode={launcherMode}
                visible={launcherVisible}
                open={open}
                unread={unread}
                onOpen={(button) => {
                  opener.current = button;
                  onOpenChange(true);
                }}
              />
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
                  // A hidden or missing opener (launcher off or hidden) cannot take focus:
                  // let Radix's default run.
                  const target = opener.current;
                  if (!target?.isConnected || target.closest("[hidden]"))
                    return;
                  event.preventDefault();
                  target.focus();
                }}
              >
                {body}
              </DialogContent>
            </Dialog>
          </PortalContainerProvider>
        </I18nProvider>
      ) : null}
    </div>
  );
}
