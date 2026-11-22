import { useCallback, useEffect, useRef, useState } from "react";
import type { Messages } from "../../../core/messages";
import {
  captureAvailable,
  captureWithHostHidden,
  failureOf,
  hostOf,
} from "../model/capture";

/** A ref that reads false once the component has unmounted. */
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}

/** Tells the dialog when the editor is open; closing the dialog resets it to the normal width. */
function useEditingSignal(
  editing: boolean,
  onEditingChange?: (editing: boolean) => void,
) {
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);
}

/**
 * The capture's state and actions: capture the screen, hold the picture being edited (a capture
 * or an uploaded image, `edit`), and tell the dialog when the editor is open.
 */
export function usePane(
  messages: Messages,
  maskTextDefault: boolean,
  onEditingChange?: (editing: boolean) => void,
) {
  const t = messages.screenshot;
  const region = useRef<HTMLDivElement>(null);
  const alive = useAlive();
  const [canCapture] = useState(captureAvailable);
  // The attachment being edited and its picture: dropped once it is saved or cancelled.
  const [edit, setEdit] = useState<{ id: string; source: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [maskText, setMaskText] = useState(maskTextDefault);

  useEditingSignal(edit !== null, onEditingChange);
  // After a commit: the control may have been unmounted while the editor was open.
  const focusRegion = useCallback(
    () => setTimeout(() => region.current?.focus(), 0),
    [],
  );

  /** Takes the picture, then hands it to `onCaptured` (which adds it and opens the editor). */
  const capture = async (onCaptured: (blob: Blob) => void) => {
    setNotice(null);
    setBusy(true);
    try {
      const blob = await captureWithHostHidden(
        hostOf(region.current),
        maskText,
      );
      if (alive.current) onCaptured(blob);
    } catch (error) {
      if (alive.current) setNotice(t.errors[failureOf(error)]);
    } finally {
      if (alive.current) setBusy(false);
      focusRegion();
    }
  };

  return {
    region,
    canCapture,
    edit,
    setEdit,
    busy,
    notice,
    setNotice,
    maskText,
    setMaskText,
    focusRegion,
    capture,
  };
}
