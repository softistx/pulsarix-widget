/** The public intake client: the persisted `submitClientReport` operation on `/public/graphql`. */

export interface ReportInput {
  title: string;
  description: string;
  email?: string;
  pageUrl?: string;
  locale: string;
  website: string;
  filledInMs: number;
}

export interface SubmittedReport {
  reportId: string;
  tracking: boolean;
}

/** What went wrong, as far as the form tells the reporter. */
export type ErrorKind =
  | "config" // no project key or no API base: nothing was sent
  | "rejected" // unknown or disabled key, origin not allowed: retrying cannot help
  | "unavailable" // 503: the rate limits cannot be checked, try later
  | "rate-limited" // 429
  | "invalid" // 400: the server refused the content
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

function kindOf(status: number, code: string): ErrorKind {
  if (status === 404 || status === 403) return "rejected";
  if (status === 503) return "unavailable";
  if (status === 429) return "rate-limited";
  if (status === 400 || status === 413 || status === 415) return "invalid";
  if (code.startsWith("intake.errors.") && status < 500) return "invalid";
  return "unknown";
}

export interface SubmitOptions {
  apiBase: string;
  publicKey: string;
  input: ReportInput;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export async function submitReport({
  apiBase,
  publicKey,
  input,
  fetch: doFetch = fetch,
  signal,
}: SubmitOptions): Promise<SubmittedReport> {
  const { email, ...rest } = input;
  const variables = {
    publicKey,
    input: { ...rest, ...(email ? { email } : {}) },
  };
  let response: Response;
  try {
    response = await doFetch(`${apiBase.replace(/\/+$/, "")}/public/graphql`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept-language": input.locale,
      },
      body: JSON.stringify({ id: "submitClientReport", variables }),
      credentials: "omit",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new IntakeError("network", "network");
  }
  let body: {
    data?: { submitClientReport?: SubmittedReport };
    errors?: GraphQLErrorBody[];
  } | null = null;
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
  const report = body?.data?.submitClientReport;
  if (!report) throw new IntakeError("unknown", "empty-response");
  return report;
}

export interface WidgetProject {
  /** The project's display name; null when the API did not give one. */
  projectName: string | null;
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
      data?: { widgetConfig?: { projectName?: unknown } };
    };
    const config = body.data?.widgetConfig;
    if (!config) return null;
    const name =
      typeof config.projectName === "string" ? config.projectName.trim() : "";
    return { projectName: name ? name.slice(0, 120) : null };
  } catch {
    return null;
  }
}
