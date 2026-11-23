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
  /** Set on a capture: the page it was taken on (origin and path). */
  pageUrl?: string;
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

/** A capture counts as the report's screenshot, so one more entry than the files is allowed. */
function limitOf(list: Entry[]) {
  return MAX_ATTACHED + (list.some((e) => e.pageUrl !== undefined) ? 1 : 0);
}

/**
 * The files of one report: those that will be sent (`ready`) and those that were refused.
 * The count and the total (with the screenshot's bytes) are checked here, mirroring the API.
 */
export function useAttachments(t: Messages["files"]) {
  const [entries, setEntries] = useState<Entry[]>([]);
  // The latest list, so `add` can decide and return what it added without a state updater.
  const latest = useRef<Entry[]>([]);
  const next = useRef(0);
  const id = useCallback(() => `file-${next.current++}`, []);
  const commit = useCallback((list: Entry[]) => {
    latest.current = list;
    setEntries(list);
  }, []);

  const add = useCallback(
    (accepted: File[], refused: DropRefusal[], captureBytes = 0): Entry[] => {
      const current = latest.current;
      const ready = current.filter((entry) => !entry.refusal);
      let count = ready.length;
      let bytes = captureBytes + ready.reduce((sum, e) => sum + e.file.size, 0);
      const added: Entry[] = [];
      const refusedNow: Entry[] = refused.map(({ file, refusal }) => ({
        id: id(),
        file,
        refusal: wording(t, refusal),
      }));
      for (const file of accepted) {
        if (count >= limitOf(ready)) {
          refusedNow.push({ id: id(), file, refusal: t.count });
        } else if (bytes + file.size > MAX_TOTAL_BYTES) {
          refusedNow.push({ id: id(), file, refusal: t.total });
        } else {
          added.push({ id: id(), file });
          count++;
          bytes += file.size;
        }
      }
      commit([
        ...ready,
        ...added,
        ...[...current.filter((e) => e.refusal), ...refusedNow].slice(
          -MAX_REFUSED_SHOWN,
        ),
      ]);
      return added;
    },
    [t, id, commit],
  );
  /** A capture of the page, with the page it was taken on; null when the report is full. */
  const addCapture = useCallback(
    (file: File, pageUrl: string): Entry | null => {
      const current = latest.current;
      const ready = current.filter((entry) => !entry.refusal);
      if (ready.length >= MAX_ATTACHED + 1) return null;
      const entry: Entry = { id: id(), file, pageUrl };
      commit([...ready, entry, ...current.filter((e) => e.refusal)]);
      return entry;
    },
    [id, commit],
  );
  const remove = useCallback(
    (entryId: string) => commit(latest.current.filter((e) => e.id !== entryId)),
    [commit],
  );
  const patch = useCallback(
    (entryId: string, change: Partial<Entry>) =>
      commit(
        latest.current.map((e) => (e.id === entryId ? { ...e, ...change } : e)),
      ),
    [commit],
  );
  const ready = entries.filter((entry) => !entry.refusal);
  return { entries, ready, add, addCapture, remove, patch };
}
