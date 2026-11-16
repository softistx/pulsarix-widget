/**
 * The second half of a report with files: `PUT /public/media/report-files/<slot>`, the raw
 * file as the body, the ticket in `x-pulsarix-ticket` (plan A12). It is an `XMLHttpRequest`
 * because `fetch` cannot report upload progress and the API wants a real `Content-Length`.
 * No credentials are sent cross-origin (`withCredentials` stays false).
 */

export type UploadFailure =
  | "type" // 415: not a PNG, JPEG, WebP or PDF, or its first bytes say otherwise
  | "size" // 413, or a picture over 25 megapixels
  | "unreadable" // 422: empty, damaged or tiny
  | "expired" // 410: the ticket's 15 minutes are over
  | "busy" // 429 or 503
  | "network" // never reached the API
  | "unknown";

export interface PutOptions {
  apiBase: string;
  slot: string;
  ticket: string;
  file: File;
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
  /** Wait before the one retry; specs shorten it. */
  retryDelayMs?: number;
}

export type PutResult = { ok: true } | { ok: false; reason: UploadFailure };

interface Outcome {
  status: number;
  code: string;
}

function send({
  apiBase,
  slot,
  ticket,
  file,
  onProgress,
  signal,
}: PutOptions): Promise<Outcome> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve({ status: 0, code: "aborted" });
    const xhr = new XMLHttpRequest();
    xhr.open(
      "PUT",
      `${apiBase.replace(/\/+$/, "")}/public/media/report-files/${encodeURIComponent(slot)}`,
    );
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("x-pulsarix-ticket", ticket);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    };
    xhr.onload = () => {
      let code = "";
      try {
        const body = JSON.parse(xhr.responseText) as {
          errors?: { extensions?: { code?: string } }[];
        };
        code = body.errors?.[0]?.extensions?.code ?? "";
      } catch {
        // A body that is not JSON: the status alone speaks.
      }
      resolve({ status: xhr.status, code });
    };
    xhr.onerror = () => resolve({ status: 0, code: "network" });
    xhr.onabort = () => resolve({ status: 0, code: "aborted" });
    const stop = () => xhr.abort();
    signal?.addEventListener("abort", stop, { once: true });
    const settle = () => signal?.removeEventListener("abort", stop);
    xhr.onloadend = settle;
    xhr.send(file);
  });
}

function failureOf({ status, code }: Outcome): UploadFailure {
  if (code.endsWith("file-too-large") || code.endsWith("file-too-many-pixels"))
    return "size";
  if (status === 415) return "type";
  if (status === 413) return "size";
  if (status === 422)
    return code.endsWith("too-many-pixels") ? "size" : "unreadable";
  if (status === 410) return "expired";
  if (status === 429 || status === 503) return "busy";
  if (status === 0) return "network";
  return "unknown";
}

/** Only what may succeed on a second try: the network, a busy or failing server. */
const retryable = ({ status }: Outcome) =>
  status === 0 ||
  status === 500 ||
  status === 502 ||
  status === 503 ||
  status === 504;

/** One PUT, then one retry when the failure is transient. */
export async function putFile(options: PutOptions): Promise<PutResult> {
  let outcome = await send(options);
  if (
    outcome.status !== 200 &&
    retryable(outcome) &&
    outcome.code !== "aborted" &&
    !options.signal?.aborted
  ) {
    options.onProgress(0);
    await new Promise((resolve) =>
      setTimeout(resolve, options.retryDelayMs ?? 1_500),
    );
    if (!options.signal?.aborted) outcome = await send(options);
  }
  if (outcome.status === 200) {
    options.onProgress(100);
    return { ok: true };
  }
  return { ok: false, reason: failureOf(outcome) };
}
