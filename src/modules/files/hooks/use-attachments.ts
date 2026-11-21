import type { DropRefusal } from "@softistx/material/files/drop";
import { useCallback, useRef, useState } from "react";
import type { Messages } from "../../../core/messages";
import { MAX_ATTACHED, MAX_TOTAL_BYTES } from "../model/rules";

/** A file the reporter chose (or tried to), and where it stands. */
export interface Entry {
  id: string;
  file: File;
  /**
   * Why it will not be sent, or why its upload failed, in the widget's own words (the list
   * does not word refusals).
   */
  refusal?: string;
  /** Uploading, 0 to 100. */
  progress?: number;
}

function wording(t: Messages["files"], refusal: DropRefusal["refusal"]) {
  switch (refusal.code) {
    case "type":
      return t.reasons.type;
    case "size":
      return t.reasons.size;
    case "empty":
      return t.reasons.unreadable;
    default:
      return t.count;
  }
}

/** Refused files stay visible so the reporter sees why, but never pile up. */
const MAX_REFUSED_SHOWN = 4;

/**
 * The files of one report: those that will be sent (`ready`) and those that were refused.
 * The count and the total (with the screenshot's bytes) are checked here, mirroring the API.
 */
export function useAttachments(t: Messages["files"]) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const next = useRef(0);
  // Stable across renders, so `add` keeps its identity.
  const id = useCallback(() => `file-${next.current++}`, []);

  const add = useCallback(
    (accepted: File[], refused: DropRefusal[], screenshotBytes: number) => {
      setEntries((current) => {
        const ready = current.filter((entry) => !entry.refusal);
        let count = ready.length;
        let bytes =
          screenshotBytes + ready.reduce((sum, e) => sum + e.file.size, 0);
        const added: Entry[] = [];
        const refusedNow: Entry[] = refused.map(({ file, refusal }) => ({
          id: id(),
          file,
          refusal: wording(t, refusal),
        }));
        for (const file of accepted) {
          if (count >= MAX_ATTACHED) {
            refusedNow.push({ id: id(), file, refusal: t.count });
          } else if (bytes + file.size > MAX_TOTAL_BYTES) {
            refusedNow.push({ id: id(), file, refusal: t.total });
          } else {
            added.push({ id: id(), file });
            count++;
            bytes += file.size;
          }
        }
        const kept = [
          ...ready,
          ...added,
          ...[...current.filter((e) => e.refusal), ...refusedNow].slice(
            -MAX_REFUSED_SHOWN,
          ),
        ];
        return kept;
      });
    },
    [t, id],
  );
  const remove = useCallback(
    (entryId: string) =>
      setEntries((current) => current.filter((e) => e.id !== entryId)),
    [],
  );
  const patch = useCallback(
    (entryId: string, change: Partial<Entry>) =>
      setEntries((current) =>
        current.map((e) => (e.id === entryId ? { ...e, ...change } : e)),
      ),
    [],
  );
  const ready = entries.filter((entry) => !entry.refusal);
  return { entries, ready, add, remove, patch };
}
