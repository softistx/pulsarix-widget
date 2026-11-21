/** The public GraphQL client: one persisted operation on `/public/graphql`, and the errors it throws. */

import type {
  PersistedId,
  PersistedOperations,
  ReportFileInput,
  SubmitClientReportMutation,
} from "./public";

/** The header the host's identity token travels in, never in a URL. */
export const IDENTITY_HEADER = "x-pulsarix-identity";

/** A file the report will carry, as `submitClientReport` wants it declared (plan A12). */
export type DeclaredFile = ReportFileInput;

/** The signed, single-use ticket the API answers for each declared file, in order. */
export type FileTicket = Pick<
  SubmitClientReportMutation["submitClientReport"]["files"][number],
  "slot" | "role" | "ticket"
>;

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
    /** Whole minutes to wait (`extensions.minutes`) on a rate limit. */
    readonly minutes?: number,
    /** The API's own message, in the request's language, for an `intake.errors.*` code. */
    readonly apiMessage?: string,
  ) {
    super(code);
    this.name = "IntakeError";
  }
}

interface GraphQLErrorBody {
  message?: string;
  extensions?: { code?: string; minutes?: number };
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
export async function publicCall<I extends PersistedId>({
  apiBase,
  id,
  variables,
  locale,
  identity,
  fetch: doFetch = fetch,
  signal,
}: {
  apiBase: string;
  id: I;
  variables: PersistedOperations[I]["variables"];
  locale: string;
  identity?: string | null;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}): Promise<PersistedOperations[I]["result"]> {
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
  let body: {
    data?: Record<string, PersistedOperations[I]["result"]>;
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
      failure?.extensions?.minutes,
      code.startsWith("intake.errors.") && failure?.message?.trim()
        ? failure.message
        : undefined,
    );
  }
  const data = body?.data?.[id];
  if (!data) throw new IntakeError("unknown", "empty-response");
  return data;
}
