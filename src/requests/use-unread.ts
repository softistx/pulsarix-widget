import { useEffect, useState } from "react";
import { fetchUnread } from "./api";

/**
 * The launcher's unread count: read when the widget mounts, when the identity changes and each
 * time the dialog closes (it is the panel's own read that updates it while the dialog is open).
 * A failed read leaves the last count; a missing identity clears it.
 *
 * The returned setter is the `useState` setter, so it is stable for the life of the component:
 * the panel and the thread may depend on it without refetching. (The panel and the thread also
 * hold the callback in a ref, so a caller passing an unstable one cannot loop either.)
 */
export function useUnread({
  apiBase,
  projectKey,
  identity,
  locale,
  open,
}: {
  apiBase: string | null;
  projectKey: string | null;
  identity: string | null;
  locale: string;
  open: boolean;
}): [number, (count: number) => void] {
  const [count, setCount] = useState(0);
  const enabled = !!apiBase && !!projectKey && !!identity;
  useEffect(() => {
    if (!enabled) setCount(0);
  }, [enabled]);
  useEffect(() => {
    if (!apiBase || !projectKey || !identity || open) return;
    const controller = new AbortController();
    fetchUnread({
      apiBase,
      publicKey: projectKey,
      identity,
      locale,
      signal: controller.signal,
    }).then(
      (unread) => {
        if (!controller.signal.aborted) setCount(unread);
      },
      () => {},
    );
    return () => controller.abort();
  }, [apiBase, projectKey, identity, locale, open]);
  return [count, setCount];
}
