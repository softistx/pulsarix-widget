import type { MetadataEntry } from "../../../config";
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
}

/**
 * What goes up besides the text. A screenshot too big for 5 MB is squeezed once, or left out
 * (`leftOut` says so in the confirmation).
 */
export async function collectUploads({
  controls,
  screenshot,
  ready,
  messages,
}: {
  controls: boolean;
  screenshot: File | null;
  ready: { id: string; file: File }[];
  messages: Messages;
}): Promise<{ toSend: Upload[]; leftOut: UploadOutcome[] }> {
  const toSend: Upload[] = [];
  const leftOut: UploadOutcome[] = [];
  if (controls && screenshot) {
    const fitted = await fitScreenshot(screenshot);
    if (fitted)
      toSend.push({ id: "screenshot", role: "screenshot", file: fitted });
    else
      leftOut.push({
        name: messages.files.screenshot,
        role: "screenshot",
        type: screenshot.type,
        size: screenshot.size,
        ok: false,
        reason: "size",
      });
  }
  if (controls)
    for (const entry of ready)
      toSend.push({ id: entry.id, role: "file", file: entry.file });
  return { toSend, leftOut };
}

const nameOf = (item: Upload) =>
  item.role === "screenshot" ? screenshotName(item.file.type) : item.file.name;

/** The API's input for a report: the typed values, the page, the honeypot and the file list. */
export function buildInput({
  values,
  locale,
  metadata,
  honeypot,
  filledInMs,
  toSend,
}: {
  values: ReportValues;
  locale: ReportInput["locale"];
  metadata?: MetadataEntry[];
  honeypot: string;
  filledInMs: number;
  toSend: Upload[];
}): ReportInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    email: values.email.trim(),
    // Origin and path only: the query string and the fragment can carry a host page's tokens.
    // None from a `file://` page or a sandboxed frame, whose origin is the string "null".
    pageUrl:
      location.origin === "null"
        ? undefined
        : (location.origin + location.pathname).slice(0, 2_048),
    locale,
    ...(values.type ? { type: values.type } : {}),
    ...(values.impact ? { impact: values.impact } : {}),
    website: honeypot,
    filledInMs,
    ...(metadata?.length ? { metadata } : {}),
    files: toSend.map((item) => ({
      role: item.role,
      name: nameOf(item),
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
            : item.file.name,
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
