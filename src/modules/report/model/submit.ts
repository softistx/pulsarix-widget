import type { MetadataEntry } from "../../../config";
import { IntakeError } from "../../../core/api/api";
import type { Messages } from "../../../core/messages";
import { screenshotName } from "../../files/model/rules";
import { submitReport } from "../api";
import type { UploadOutcome } from "../components/confirmation";
import { buildInput, capturePagesOf, collectUploads, uploadAll } from "./send";
import type { SubmitDetail } from "./types";
import type { ReportValues } from "./validation";

/** What one submission needs from the flow: its settings, its attachments and where it reports. */
export interface SubmitContext {
  messages: Messages;
  locale: "en" | "fr";
  projectKey: string | null;
  apiBase: string | null;
  controls: boolean;
  overTotal: boolean;
  ready: { id: string; file: File; pageUrl?: string }[];
  patch: (id: string, change: { progress: number }) => void;
  metadata?: MetadataEntry[];
  identity?: string | null;
  draft?: { current: ReportValues | null };
  minFillMs: number;
  retryDelayMs?: number;
  openedAt: number;
  honeypot: string;
  signal: AbortSignal;
  setFailure: (failure: IntakeError | null) => void;
  setSent: (sent: { tracking: boolean; uploads: UploadOutcome[] }) => void;
  onSubmitted: (detail: SubmitDetail) => void;
  onError: (detail: { code: string }) => void;
}

/**
 * Sends the report, then puts each file to its ticket. A close before `submitReport` resolves
 * aborts it and emits nothing (the report may not exist). From then on the report is saved:
 * `pulsarix:submit` fires once even if the dialog closed during the PUTs (those read as not
 * uploaded); only the confirmation is skipped.
 */
export async function runSubmit(
  values: ReportValues,
  ctx: SubmitContext,
): Promise<void> {
  const { signal } = ctx;
  ctx.setFailure(null);
  const fail = (error: IntakeError) => {
    ctx.setFailure(error);
    ctx.onError({ code: error.code });
  };
  if (!ctx.projectKey || !ctx.apiBase)
    return fail(new IntakeError("config", "config"));
  if (ctx.overTotal) return;
  const wait = ctx.minFillMs - (Date.now() - ctx.openedAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  if (signal.aborted) return;
  const { toSend, leftOut } = await collectUploads({
    controls: ctx.controls,
    ready: ctx.ready,
    messages: ctx.messages,
  });
  const input = buildInput({
    values,
    locale: ctx.locale,
    metadata: ctx.metadata,
    honeypot: ctx.honeypot,
    filledInMs: Date.now() - ctx.openedAt,
    toSend,
    capturePages: capturePagesOf(ctx.ready, toSend),
  });
  try {
    const report = await submitReport({
      apiBase: ctx.apiBase,
      publicKey: ctx.projectKey,
      input,
      identity: ctx.identity,
      signal,
    });
    const progress = (id: string, percent: number) =>
      ctx.patch(id, { progress: percent });
    for (const item of toSend) progress(item.id, 0);
    const results = await uploadAll({
      apiBase: ctx.apiBase,
      report,
      toSend,
      messages: ctx.messages,
      onProgress: progress,
      signal,
      retryDelayMs: ctx.retryDelayMs,
    });
    const uploads = [...leftOut, ...results];
    // The report exists: the draft is spent, whether or not the dialog is still open.
    if (ctx.draft) ctx.draft.current = null;
    if (!signal.aborted) ctx.setSent({ tracking: report.tracking, uploads });
    ctx.onSubmitted({
      reportId: report.reportId,
      files: uploads.map(({ name, role, type, size, ok }) => ({
        name: role === "screenshot" ? screenshotName(type) : name,
        role,
        type,
        size,
        uploaded: ok,
      })),
    });
  } catch (error) {
    if (signal.aborted) return;
    fail(
      error instanceof IntakeError
        ? error
        : new IntakeError("unknown", "unknown"),
    );
  }
}
