import {
  METADATA_MAX_BYTES,
  METADATA_MAX_ENTRIES,
  METADATA_VALUE_MAX,
  type MetadataEntry,
} from "../../../config";
import type { Messages } from "../../../core/messages";
import { fitScreenshot, screenshotName } from "../../files/model/rules";
import {
  type PutResult,
  putFile,
  type UploadFailure,
} from "../../files/model/upload";
import type { ReportInput, submitReport } from "../api";
import type { UploadOutcome } from "../components/confirmation";
import type { ReportValues } from "./validation";

/** One file that goes up after the report: the screenshot or an attachment. */
export interface Upload {
  id: string;
  role: "screenshot" | "file";
  file: File;
  /** Taken with the capture button: its name and page key carry its position among captures. */
  capture?: boolean;
}

/**
 * What goes up besides the text. A screenshot too big for 5 MB is squeezed once, or left out
 * (`leftOut` says so in the confirmation).
 */
export async function collectUploads({
  controls,
  ready,
  messages,
}: {
  controls: boolean;
  /** Every ready attachment, in order; a capture is flagged by its page. */
  ready: { id: string; file: File; pageUrl?: string }[];
  messages: Messages;
}): Promise<{ toSend: Upload[]; leftOut: UploadOutcome[] }> {
  const toSend: Upload[] = [];
  const leftOut: UploadOutcome[] = [];
  if (!controls) return { toSend, leftOut };
  // The first capture goes up as the report's screenshot; the others, and the files, as files.
  const firstCapture = ready.find((entry) => entry.pageUrl !== undefined);
  for (const entry of ready) {
    if (entry.pageUrl === undefined) {
      toSend.push({ id: entry.id, role: "file", file: entry.file });
      continue;
    }
    const role = entry === firstCapture ? "screenshot" : "file";
    const fitted = await fitScreenshot(entry.file);
    if (fitted)
      toSend.push({ id: entry.id, role, file: fitted, capture: true });
    else
      leftOut.push({
        name: messages.files.screenshot,
        role,
        type: entry.file.type,
        size: entry.file.size,
        ok: false,
        reason: "size",
      });
  }
  return { toSend, leftOut };
}

/** The page of each capture that goes up, in order; "" for a capture with no page (a `file://` one). */
export function capturePagesOf(
  ready: { id: string; pageUrl?: string }[],
  toSend: Upload[],
): string[] {
  const sent = new Set(toSend.map((item) => item.id));
  return ready
    .filter((entry) => entry.pageUrl !== undefined && sent.has(entry.id))
    .map((entry) => entry.pageUrl as string);
}

/**
 * The page the widget runs on: origin and path only, since the query string and the fragment can
 * carry a host page's tokens. None from a `file://` page or a sandboxed frame, whose origin is the
 * string "null".
 */
export function pageOf(): string | undefined {
  return location.origin === "null"
    ? undefined
    : (location.origin + location.pathname).slice(0, 2_048);
}

const encoder = new TextEncoder();
const sizeOf = (e: MetadataEntry) =>
  encoder.encode(e.key).length + encoder.encode(e.value).length;

/**
 * The host's metadata with one `capture-N-page` entry per capture. The captures' entries are kept
 * and the host's are dropped from the end until the whole fits the API's limits (entries, bytes).
 */
function withCapturePages(
  host: MetadataEntry[],
  pages: string[],
): MetadataEntry[] {
  const own = pages.flatMap((value, index) =>
    value
      ? [
          {
            key: `capture-${index + 1}-page`,
            value: value.slice(0, METADATA_VALUE_MAX),
          },
        ]
      : [],
  );
  const room = (list: MetadataEntry[]) =>
    list.length + own.length <= METADATA_MAX_ENTRIES &&
    [...list, ...own].reduce((n, e) => n + sizeOf(e), 0) <= METADATA_MAX_BYTES;
  const kept = host.filter((entry) => !RESERVED_KEY.test(entry.key));
  while (kept.length && !room(kept)) kept.pop();
  return [...kept, ...own];
}

/** Keys the widget writes itself: a host's entry of the same shape is dropped. */
const RESERVED_KEY = /^capture-\d+-page$/;

/** A capture is `screenshot.png`, then `screenshot-2.png`…; a file keeps its own name. */
function nameOf(item: Upload, toSend: Upload[]): string {
  if (!item.capture) return item.file.name;
  const no = toSend.filter((u) => u.capture).indexOf(item) + 1;
  const base = screenshotName(item.file.type);
  return no > 1 ? base.replace(/(\.\w+)$/, `-${no}$1`) : base;
}

/** The API's input for a report: the typed values, the page, the honeypot and the file list. */
export function buildInput({
  values,
  locale,
  metadata,
  honeypot,
  filledInMs,
  toSend,
  capturePages = [],
}: {
  values: ReportValues;
  locale: ReportInput["locale"];
  metadata?: MetadataEntry[];
  honeypot: string;
  filledInMs: number;
  toSend: Upload[];
  /** The page of each capture, in order: the first is the report's page, each is also metadata. */
  capturePages?: string[];
}): ReportInput {
  const allMetadata = withCapturePages(metadata ?? [], capturePages);
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    email: values.email.trim(),
    pageUrl: capturePages[0] || pageOf(),
    locale,
    ...(values.type ? { type: values.type } : {}),
    ...(values.impact ? { impact: values.impact } : {}),
    website: honeypot,
    filledInMs,
    ...(allMetadata.length ? { metadata: allMetadata } : {}),
    files: toSend.map((item) => ({
      role: item.role,
      name: nameOf(item, toSend),
      type: item.file.type,
      size: item.file.size,
    })),
  };
}

/** Puts each file to its ticket, in parallel; a missing or mismatched ticket is "unknown". */
export function uploadAll({
  apiBase,
  report,
  toSend,
  messages,
  onProgress,
  signal,
  retryDelayMs,
}: {
  apiBase: string;
  report: Awaited<ReturnType<typeof submitReport>>;
  toSend: Upload[];
  messages: Messages;
  onProgress: (id: string, percent: number) => void;
  signal: AbortSignal;
  retryDelayMs?: number;
}): Promise<UploadOutcome[]> {
  return Promise.all(
    toSend.map(async (item, index): Promise<UploadOutcome> => {
      const ticket = report.files[index];
      const done = (
        result: PutResult | { ok: false; reason: UploadFailure },
      ) => ({
        name:
          item.role === "screenshot"
            ? messages.files.screenshot
            : nameOf(item, toSend),
        role: item.role,
        type: item.file.type,
        size: item.file.size,
        ...result,
      });
      if (!ticket || ticket.role !== item.role)
        return done({ ok: false, reason: "unknown" });
      return done(
        await putFile({
          apiBase,
          slot: ticket.slot,
          ticket: ticket.ticket,
          file: item.file,
          onProgress: (percent) => onProgress(item.id, percent),
          signal,
          retryDelayMs,
        }),
      );
    }),
  );
}
