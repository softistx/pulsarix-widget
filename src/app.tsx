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
} from "@softistx/material/embed";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { AppProps } from "./app-props";
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
  // While the screenshot editor is open the dialog widens: the editor needs more than a form.
  const [editing, setEditing] = useState(false);
  // The key's config survives a change of view (the form remounts), not a close.
  const [project, setProject] = useState<WidgetProject | null>(null);
  const identified = !!identity && !!projectKey && !!apiBase;
  // "My requests" is its own view, with its own title; a dialog opens on the report.
  const [view, setView] = useState<"report" | "requests">("report");
  const showing = identified ? view : "report";
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
  // A dialog opens on the form.
  useEffect(() => {
    if (!open) {
      setView("report");
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
  const toRequests = (
    <Button
      type="button"
      variant="tonal"
      size="sm"
      className="mt-2 justify-self-start"
      onClick={() => {
        // The form unmounts with its screenshot: the editor is closed with it.
        setEditing(false);
        setView("requests");
      }}
    >
      {messages.myRequests}
      {unread > 0 ? (
        <Badge size="sm" variant="error" className="ml-1.5">
          <span aria-hidden="true">{unread > 99 ? "99+" : unread}</span>
          <span className="sr-only"> {messages.unreadReplies(unread)}</span>
        </Badge>
      ) : null}
    </Button>
  );
  const body = (
    <>
      {showing === "requests" && identity ? (
        <Suspense
          fallback={
            <>
              <DialogHeader>
                <DialogTitle>{messages.myRequests}</DialogTitle>
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
            onUnread={setUnread}
            onReply={onReply}
            onError={onError}
            onErase={onErase}
            onClose={() => onOpenChange(false)}
            onNewRequest={() => {
              setEditing(false);
              setView("report");
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
          onEditing={setEditing}
          attachments={attachments}
          prefill={prefill}
          metadata={metadata}
          privacyUrl={privacyUrl}
          draft={draft}
          identity={identity}
          headerExtra={identified ? toRequests : undefined}
          project={project}
          onProject={setProject}
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
          initialLanguage={locale}
          supportedLanguages={["en", "fr"]}
          defaultLanguage={locale}
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
                layout="stack"
                size="md"
                // The editor needs room (px, not rem: the host owns the root font size).
                className={editing ? "max-w-[1100px]" : undefined}
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
