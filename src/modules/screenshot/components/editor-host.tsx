import { Alert, Spinner } from "@softistx/material/embed";
import { lazy, Suspense } from "react";
import type { Messages } from "../../../core/messages";

// The editor and its stylesheet are a separate chunk, fetched when a picture is first edited.
const Editor = lazy(() => import("./editor"));

/** The busy spinner or the warning notice, in a polite live region. */
export function PaneStatus({
  messages,
  busy,
  notice,
}: {
  messages: Messages;
  busy: boolean;
  notice: string | null;
}) {
  return (
    <div role="status" aria-live="polite" className="empty:hidden">
      {busy ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Spinner aria-hidden="true" className="size-4" />
          {messages.screenshot.capturing}
        </div>
      ) : notice ? (
        <Alert variant="warning" description={notice} />
      ) : null}
    </div>
  );
}

/** The lazy editor over the picture being edited. */
export function EditorHost({
  messages,
  source,
  pageUrl,
  onSave,
  onCancel,
}: {
  messages: Messages;
  source: Blob;
  /** The page the capture was taken on, shown above the editor. */
  pageUrl?: string;
  onSave: (file: File) => void;
  onCancel: () => void;
}) {
  const t = messages.screenshot;
  return (
    <section aria-label={t.editorLabel} className="grid min-h-0 gap-2">
      {pageUrl ? (
        <p className="truncate text-muted-foreground text-xs">
          {t.capturedOn(pageUrl)}
        </p>
      ) : null}
      <Suspense
        fallback={
          <div
            role="status"
            className="flex items-center gap-2 text-muted-foreground text-sm"
          >
            <Spinner aria-hidden="true" className="size-4" />
            {t.loadingEditor}
          </div>
        }
      >
        <Editor
          source={source}
          saveLabel={t.save}
          onSave={onSave}
          onCancel={onCancel}
        />
      </Suspense>
    </section>
  );
}
