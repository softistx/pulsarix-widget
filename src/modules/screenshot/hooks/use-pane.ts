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
 * The capture's state and actions: capture the screen, hold the picture being edited, and tell
 * the dialog when the editor is open. An uploaded image is a plain attachment (the `files`
 * module), never edited.
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
  // The picture being edited: dropped (and so unreachable) once it is saved or cancelled.
  const [source, setSource] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [maskText, setMaskText] = useState(maskTextDefault);

  useEditingSignal(source !== null, onEditingChange);
  // After a commit: the control may have been unmounted while the editor was open.
  const focusRegion = useCallback(
    () => setTimeout(() => region.current?.focus(), 0),
    [],
  );

  const capture = async () => {
    setNotice(null);
    setBusy(true);
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

  return {
    region,
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
  };
}
