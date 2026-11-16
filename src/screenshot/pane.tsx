import { Alert, Button } from "@softistx/material/embed";
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { Messages } from "../messages";
import {
  captureAvailable,
  captureWithHostHidden,
  failureOf,
  hostOf,
} from "./capture";
import { Preview } from "./preview";

// The editor and its stylesheet are a separate chunk, fetched when a picture is first edited.
const Editor = lazy(() => import("./editor"));

/** Plan decision: PNG, JPEG and WebP, 25 megapixels at most (the API checks again). */
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_PIXELS = 25_000_000;

type Origin = "capture" | "upload";

export interface ScreenshotPaneProps {
  messages: Messages;
  /** The flattened export that is kept, or null. The raw capture is never held outside the pane. */
  image: File | null;
  onImage: (image: File | null) => void;
  /** The mask-text option starts on (`data-mask-text="true"`). */
  maskTextDefault?: boolean;
  /** Told when the editor opens or closes: the dialog widens its pane while it is open. */
  onEditingChange?: (editing: boolean) => void;
}

/** Reads an uploaded file's size without keeping it: a refusal key, or null when it is usable. */
async function refusalOf(
  file: File,
): Promise<"type" | "tooLarge" | "unreadable" | null> {
  if (!ACCEPTED.includes(file.type)) return "type";
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const pixels = bitmap.width * bitmap.height;
    bitmap.close();
    return pixels > MAX_PIXELS ? "tooLarge" : null;
  } catch {
    return "unreadable";
  }
}

/**
 * The right pane of the split dialog: choose a picture (screen capture, or an uploaded
 * image), annotate it in the lazy editor, and keep only the flattened export. Retake and
 * remove drop it again. A report is complete without any of this.
 */
export function ScreenshotPane({
  messages,
  image,
  onImage,
  maskTextDefault = false,
  onEditingChange,
}: ScreenshotPaneProps) {
  const t = messages.screenshot;
  const ids = useId();
  const region = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const [canCapture] = useState(captureAvailable);
  // The picture being edited: dropped (and so unreachable) once it is saved or cancelled.
  const [source, setSource] = useState<Blob | null>(null);
  const [origin, setOrigin] = useState<Origin>("upload");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [maskText, setMaskText] = useState(maskTextDefault);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const editing = source !== null;
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  // Closing the dialog unmounts the pane: the next opening starts at the normal width.
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);
  const focusRegion = useCallback(
    () => queueMicrotask(() => region.current?.focus()),
    [],
  );

  const capture = async () => {
    setNotice(null);
    setBusy(true);
    setOrigin("capture");
    try {
      const blob = await captureWithHostHidden(
        hostOf(region.current),
        maskText,
      );
      if (alive.current) setSource(blob);
    } catch (error) {
      if (alive.current) setNotice(t.errors[failureOf(error)]);
    } finally {
      if (alive.current) setBusy(false);
      focusRegion();
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setNotice(null);
    setBusy(true);
    setOrigin("upload");
    const refusal = await refusalOf(file);
    if (!alive.current) return;
    setBusy(false);
    if (refusal) setNotice(t.errors[refusal]);
    else setSource(file);
    focusRegion();
  };

  const pickFile = () => {
    setNotice(null);
    fileInput.current?.click();
  };
  const again = () =>
    origin === "capture" && canCapture ? capture() : pickFile();

  const status = (
    <div role="status" aria-live="polite" className="empty:hidden">
      {busy ? (
        <p className="sr-only">{t.capturing}</p>
      ) : notice ? (
        <Alert variant="warning" description={notice} />
      ) : null}
    </div>
  );

  let body: ReactNode;
  if (source) {
    body = (
      <div role="group" aria-label={t.editorLabel} className="min-h-0">
        <Suspense
          fallback={
            <p role="status" className="text-muted-foreground text-sm">
              {t.loadingEditor}
            </p>
          }
        >
          <Editor
            source={source}
            saveLabel={t.save}
            onSave={(file) => {
              setSource(null);
              onImage(file);
              focusRegion();
            }}
            onCancel={() => {
              setSource(null);
              focusRegion();
            }}
          />
        </Suspense>
      </div>
    );
  } else if (image) {
    body = (
      <div className="grid content-start gap-3">
        <Preview image={image} alt={t.previewAlt} />
        <p className="text-muted-foreground text-xs">{t.saved}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="tonal"
            size="sm"
            disabled={busy}
            onClick={() => void again()}
          >
            {t.retake}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              onImage(null);
              setNotice(null);
              focusRegion();
            }}
          >
            {t.remove}
          </Button>
        </div>
        {status}
      </div>
    );
  } else {
    body = (
      <div className="flex min-h-48 flex-col md:h-full items-center justify-center gap-4 rounded-lg border border-border border-dashed p-6 text-center">
        <div className="grid gap-1">
          <p className="font-medium text-foreground text-sm">
            {messages.aside.title}
          </p>
          <p className="text-muted-foreground text-xs">
            {messages.aside.empty}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {canCapture ? (
            <Button type="button" loading={busy} onClick={() => void capture()}>
              {t.add}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={canCapture ? "tonal" : "filled"}
            disabled={busy}
            onClick={pickFile}
          >
            {t.upload}
          </Button>
        </div>
        {canCapture ? (
          <div className="flex max-w-xs items-start gap-2 text-left">
            <input
              id={`${ids}-mask`}
              type="checkbox"
              checked={maskText}
              disabled={busy}
              onChange={(event) => setMaskText(event.currentTarget.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <label htmlFor={`${ids}-mask`} className="grid gap-0.5 text-xs">
              <span className="font-medium text-foreground">{t.maskText}</span>
              <span className="text-muted-foreground">{t.maskTextHint}</span>
            </label>
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">{t.hint}</p>
        {status}
      </div>
    );
  }

  return (
    <div
      ref={region}
      tabIndex={-1}
      className="min-h-0 outline-none md:h-full"
      data-testid="screenshot-pane"
    >
      {body}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(",")}
        hidden
        data-testid="screenshot-file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          void upload(file);
        }}
      />
    </div>
  );
}
