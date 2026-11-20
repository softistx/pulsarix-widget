import { useCallback, useEffect, useRef, useState } from "react";
import type { Messages } from "../messages";
import {
  captureAvailable,
  captureWithHostHidden,
  failureOf,
  hostOf,
} from "./capture";

/** Plan decision: PNG, JPEG and WebP, 25 megapixels at most (the API checks again). */
export const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_PIXELS = 25_000_000;

type Origin = "capture" | "upload";

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
 * The pane's state and actions: capture the screen or take an uploaded file, hold the picture
 * being edited, and tell the dialog when the editor is open.
 */
export function usePane(
  messages: Messages,
  maskTextDefault: boolean,
  onEditingChange?: (editing: boolean) => void,
) {
  const t = messages.screenshot;
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

  return {
    region,
    fileInput,
    canCapture,
    source,
    setSource,
    busy,
    notice,
    setNotice,
    maskText,
    setMaskText,
    focusRegion,
    capture,
    upload,
    pickFile,
    again,
  };
}
