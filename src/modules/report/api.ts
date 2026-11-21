/** The report module's operations: `submitClientReport` and `widgetConfig`. */

import { type FileTicket, publicCall } from "../../core/api/api";
import type {
  PersistedId,
  ReportImpact,
  ReportType,
  SubmitClientReportMutation,
  SubmitClientReportMutationVariables,
  WidgetConfigQuery,
} from "../../core/api/public";

export type { ReportImpact, ReportType };

export type ReportInput = Omit<
  SubmitClientReportMutationVariables["input"],
  "locale" | "website"
> & {
  locale: string;
  website: string;
};

export type SubmittedReport = Omit<
  SubmitClientReportMutation["submitClientReport"],
  "files"
> & {
  /** One ticket per declared file; empty when none was declared. */
  files: FileTicket[];
};

export interface SubmitOptions {
  apiBase: string;
  publicKey: string;
  input: ReportInput;
  /** The host's identity token: the report is then the reporter's own, listed in My requests. */
  identity?: string | null;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export async function submitReport({
  apiBase,
  publicKey,
  input,
  identity,
  fetch,
  signal,
}: SubmitOptions): Promise<SubmittedReport> {
  const { email, files, metadata, ...rest } = input;
  const report = await publicCall({
    apiBase,
    id: "submitClientReport",
    variables: {
      publicKey,
      input: {
        ...rest,
        ...(email ? { email } : {}),
        ...(files?.length ? { files } : {}),
        ...(metadata?.length ? { metadata } : {}),
      },
    },
    locale: input.locale,
    identity,
    fetch,
    signal,
  });
  return { ...report, files: report.files ?? [] };
}

export interface WidgetProject {
  /** The project's display name; null when the API did not give one. */
  projectName: string | null;
  /** Whether the key takes a screenshot and files (the key's `attachmentsEnabled`). */
  attachments: boolean;
}

/**
 * The public `widgetConfig` operation: the project a key belongs to. A cosmetic read, so any
 * failure answers null and the form simply shows no project name.
 */
export async function fetchWidgetConfig({
  apiBase,
  publicKey,
  locale,
  fetch: doFetch = fetch,
  signal,
}: {
  apiBase: string;
  publicKey: string;
  locale: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}): Promise<WidgetProject | null> {
  try {
    const id: PersistedId = "widgetConfig";
    const response = await doFetch(
      `${apiBase.replace(/\/+$/, "")}/public/graphql`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": locale,
        },
        body: JSON.stringify({ id, variables: { publicKey } }),
        credentials: "omit",
        signal,
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { widgetConfig?: Partial<WidgetConfigQuery["widgetConfig"]> };
    };
    const config = body.data?.widgetConfig;
    if (!config) return null;
    const name =
      typeof config.projectName === "string" ? config.projectName.trim() : "";
    return {
      projectName: name ? name.slice(0, 120) : null,
      // Absent (an older API) counts as off: the widget then behaves as v1, with no file controls.
      attachments: config.attachments === true,
    };
  } catch {
    return null;
  }
}
