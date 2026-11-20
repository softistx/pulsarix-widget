import { Alert, Button, Checkbox, Spinner } from "@softistx/material/embed";
import { lazy, type ReactNode, Suspense } from "react";
import type { Messages } from "../messages";
import { Preview } from "./preview";

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
  onSave,
  onCancel,
}: {
  messages: Messages;
  source: Blob;
  onSave: (file: File) => void;
  onCancel: () => void;
}) {
  const t = messages.screenshot;
  return (
    <section aria-label={t.editorLabel} className="min-h-0 md:h-full">
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

/** The kept picture with its retake and remove actions. */
export function SavedView({
  messages,
  image,
  busy,
  onRetake,
  onRemove,
  status,
}: {
  messages: Messages;
  image: File;
  busy: boolean;
  onRetake: () => void;
  onRemove: () => void;
  status: ReactNode;
}) {
  const t = messages.screenshot;
  return (
    <div className="grid content-start gap-3">
      <Preview image={image} alt={t.previewAlt} />
      <p className="text-muted-foreground text-xs">{t.saved}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="tonal"
          size="sm"
          disabled={busy}
          onClick={onRetake}
        >
          {t.retake}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={onRemove}
        >
          {t.remove}
        </Button>
      </div>
      {status}
    </div>
  );
}

/** No picture yet: capture the screen, upload a file, and the mask-text option. */
export function EmptyView({
  messages,
  canCapture,
  busy,
  maskText,
  onMaskText,
  onCapture,
  onPick,
  status,
}: {
  messages: Messages;
  canCapture: boolean;
  busy: boolean;
  maskText: boolean;
  onMaskText: (value: boolean) => void;
  onCapture: () => void;
  onPick: () => void;
  status: ReactNode;
}) {
  const t = messages.screenshot;
  return (
    <div className="flex min-h-48 flex-col md:h-full items-center justify-center gap-4 rounded-lg border border-border border-dashed p-6 text-center">
      <div className="grid gap-1">
        <p className="font-medium text-foreground text-sm">
          {messages.aside.title}
        </p>
        <p className="text-muted-foreground text-xs">{messages.aside.empty}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {canCapture ? (
          <Button type="button" loading={busy} onClick={onCapture}>
            {t.add}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={canCapture ? "tonal" : "filled"}
          disabled={busy}
          onClick={onPick}
        >
          {t.upload}
        </Button>
      </div>
      {canCapture ? (
        <div className="max-w-xs text-left">
          <Checkbox
            checked={maskText}
            disabled={busy}
            onCheckedChange={(checked) => onMaskText(checked === true)}
            label={t.maskText}
            helperText={t.maskTextHint}
          />
        </div>
      ) : null}
      <p className="text-muted-foreground text-xs">{t.hint}</p>
      {status}
    </div>
  );
}
