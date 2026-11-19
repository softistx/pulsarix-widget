import { useEffect, useState } from "react";
import { fetchWidgetConfig, type WidgetProject } from "../api";
import type { Locale } from "../config";

/**
 * The key's own config (`attachmentsEnabled`, the project's name): unknown counts as off, so
 * the controls never flash. They show once the config says so; an API that does not send it,
 * or a failed config read, leaves them off (v1 behaviour, see `fetchWidgetConfig`).
 * `project` is what the owner of the dialog already read (a tab switch remounts the flow).
 */
export function useProject({
  apiBase,
  projectKey,
  locale,
  project,
  attachments,
  onProject,
  onControls,
}: {
  apiBase: string | null;
  projectKey: string | null;
  locale: Locale;
  project?: WidgetProject | null;
  attachments: boolean;
  onProject?: (project: WidgetProject | null) => void;
  onControls?: (shown: boolean) => void;
}): { projectName: string | null; controls: boolean } {
  const [own, setOwn] = useState<{
    read: boolean;
    config: WidgetProject | null;
  }>({
    read: project !== undefined && project !== null,
    config: project ?? null,
  });
  const controls = attachments && (own.config?.attachments ?? false);
  useEffect(() => onControls?.(controls), [controls, onControls]);
  useEffect(() => {
    if (!projectKey || !apiBase || own.read) return;
    const controller = new AbortController();
    void fetchWidgetConfig({
      apiBase,
      publicKey: projectKey,
      locale,
      signal: controller.signal,
    }).then((config) => {
      if (controller.signal.aborted) return;
      setOwn({ read: true, config });
      onProject?.(config);
    });
    return () => controller.abort();
  }, [apiBase, projectKey, locale, own.read, onProject]);
  return { projectName: own.config?.projectName ?? null, controls };
}
