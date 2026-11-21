/** The public intake client: the persisted `submitClientReport` operation on `/public/graphql`. */

import type {
  PersistedId,
  ReportFileInput,
  ReportImpact,
  ReportType,
  SubmitClientReportMutation,
  SubmitClientReportMutationVariables,
  WidgetConfigQuery,
} from "./graphql/public";

/** The header the host's identity token travels in, never in a URL. */
export const IDENTITY_HEADER = "x-pulsarix-identity";

/** A file the report will carry, as `submitClientReport` wants it declared (plan A12). */
export type DeclaredFile = ReportFileInput;

/** The signed, single-use ticket the API answers for each declared file, in order. */
export type FileTicket = Pick<
  SubmitClientReportMutation["submitClientReport"]["files"][number],
  "slot" | "role" | "ticket"
>;

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

/** What went wrong, as far as the form tells the reporter. */
export type ErrorKind =
  | "config" // no project key or no API base: nothing was sent
  | "identity" // 401: the identity token is missing, forged or expired
  | "rejected" // unknown or disabled key, origin not allowed: retrying cannot help
  | "unavailable" // 503: the rate limits cannot be checked, try later
  | "rate-limited" // 429
  | "invalid" // 400: the server refused the content
  | "files" // the declared files were refused (type, size, count, or switched off for the key)
  | "network" // the request did not reach the API
  | "unknown";

export class IntakeError extends Error {
  constructor(
    readonly kind: ErrorKind,
    /** The API's own code (`intake.errors.…`) when it gave one, else the kind. */
    readonly code: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "IntakeError";
  }
}

interface GraphQLErrorBody {
  message?: string;
  extensions?: { code?: string; retryAfter?: number };
}

const FILE_CODES = new Set([
  "file-unsupported-type",
  "file-too-large",
  "file-undecodable",
  "file-too-many-pixels",
  "too-many-files",
  "files-too-large",
  "attachments-disabled",
]);

function kindOf(status: number, code: string): ErrorKind {
  if (FILE_CODES.has(code.replace("intake.errors.", ""))) return "files";
  if (status === 401 || code === "intake.errors.identity-invalid")
    return "identity";
  if (status === 404 || status === 403) return "rejected";
  if (status === 503) return "unavailable";
  if (status === 429) return "rate-limited";
  if (status === 400 || status === 413 || status === 415) return "invalid";
  if (code.startsWith("intake.errors.") && status < 500) return "invalid";
  return "unknown";
}

/** One persisted operation on `/public/graphql`: its data, or an `IntakeError`. */
export async function publicCall<T>({
  apiBase,
  id,
  variables,
  locale,
  identity,
  fetch: doFetch = fetch,
  signal,
}: {
  apiBase: string;
  id: PersistedId;
  variables: object;
  locale: string;
  identity?: string | null;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}): Promise<T> {
  let response: Response;
  try {
    response = await doFetch(`${apiBase.replace(/\/+$/, "")}/public/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept-language": locale,
        ...(identity ? { [IDENTITY_HEADER]: identity } : {}),
      },
      body: JSON.stringify({ id, variables }),
      credentials: "omit",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new IntakeError("network", "network");
  }
  let body: { data?: Record<string, T>; errors?: GraphQLErrorBody[] } | null =
    null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const failure = body?.errors?.[0];
  if (!response.ok || failure) {
    const code = failure?.extensions?.code ?? `http-${response.status}`;
    throw new IntakeError(
      kindOf(response.status, code),
      code,
      failure?.extensions?.retryAfter,
    );
  }
  const data = body?.data?.[id];
  if (!data) throw new IntakeError("unknown", "empty-response");
  return data;
}

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
  const report = await publicCall<
    Omit<SubmittedReport, "files"> & { files?: FileTicket[] }
  >({
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
    const response = await doFetch(
      `${apiBase.replace(/\/+$/, "")}/public/graphql`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept-language": locale,
        },
        body: JSON.stringify({ id: "widgetConfig", variables: { publicKey } }),
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
