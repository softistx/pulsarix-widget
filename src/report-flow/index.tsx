import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  fetchWidgetConfig,
  IntakeError,
  type ReportInput,
  submitReport,
} from "../api";
import type { Locale } from "../config";
import { fitScreenshot, MAX_TOTAL_BYTES, screenshotName } from "../files/rules";
import { AttachmentsSection } from "../files/section";
import { type PutResult, putFile, type UploadFailure } from "../files/upload";
import { type Entry, useAttachments } from "../files/use-attachments";
import type { Messages } from "../messages";
import { type ReportValues, resolverFor } from "../validation";
import { Confirmation, type UploadOutcome } from "./confirmation";
import { Form } from "./form";

/** The API refuses a report sent faster than this after the form opened (`MIN_FILL_MS`). */
export const MIN_FILL_MS = 3_000;

/** What `pulsarix:submit` carries: the report, and what became of each file. */
export interface SubmitDetail {
  reportId: string;
  files: {
    name: string;
    role: "screenshot" | "file";
    type: string;
    size: number;
    uploaded: boolean;
  }[];
}

export interface ReportFlowProps {
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  onSubmitted: (detail: SubmitDetail) => void;
  onError: (detail: { code: string }) => void;
  onClose: () => void;
  /** Told when the confirmation shows (no screenshot pane, so the dialog is not split). */
  onDone?: (done: boolean) => void;
  /** Told when the screenshot editor opens or closes (the dialog widens its pane). */
  onEditing?: (editing: boolean) => void;
  /** Overridable for specs; the API's own minimum otherwise. */
  minFillMs?: number;
  /** The screenshot's mask-text option starts on (`data-mask-text="true"`). */
  maskText?: boolean;
  /** `data-attachments="false"` turns the screenshot and file controls off. */
  attachments?: boolean;
  /** Told whether the controls show (the key's own switch is known once its config is read). */
  onControls?: (shown: boolean) => void;
  /** Wait before an upload's one retry; specs shorten it. */
  retryDelayMs?: number;
}

/**
 * The dialog's content: the report form, then the confirmation. It lives inside the
 * dialog's popup, so closing the dialog unmounts it and the next opening starts blank.
 */
export function ReportFlow({
  messages,
  locale,
  projectKey,
  apiBase,
  onSubmitted,
  onError,
  onClose,
  onDone,
  onEditing,
  minFillMs = MIN_FILL_MS,
  maskText = false,
  attachments = true,
  onControls,
  retryDelayMs,
}: ReportFlowProps) {
  const openedAt = useRef(Date.now());
  const honeypot = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLDivElement>(null);
  const alertBox = useRef<HTMLDivElement>(null);
  const aborted = useRef(new AbortController());
  // Closing the dialog unmounts this: nothing is sent, and nothing is reported, after it.
  useEffect(() => {
    const controller = new AbortController();
    aborted.current = controller;
    return () => controller.abort();
  }, []);
  const [failure, setFailure] = useState<IntakeError | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  // The key's own switch (`attachmentsEnabled`): on until the config says otherwise.
  const [keyAttachments, setKeyAttachments] = useState(true);
  const controls = attachments && keyAttachments;
  useEffect(() => onControls?.(controls), [controls, onControls]);
  useEffect(() => {
    if (!projectKey || !apiBase) return;
    const controller = new AbortController();
    void fetchWidgetConfig({
      apiBase,
      publicKey: projectKey,
      locale,
      signal: controller.signal,
    }).then((config) => {
      if (controller.signal.aborted) return;
      setProjectName(config?.projectName ?? null);
      setKeyAttachments(config?.attachments ?? true);
    });
    return () => controller.abort();
  }, [apiBase, projectKey, locale]);
  // The flattened export of the annotated screenshot (W2c sends it); nothing else of the capture lives on.
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [sent, setSent] = useState<{
    tracking: boolean;
    uploads: UploadOutcome[];
  } | null>(null);
  const files = useAttachments(messages.files);
  // The screenshot's own row, shown only while the files go up.
  const [shotRow, setShotRow] = useState<Entry | null>(null);
  const readyBytes = files.ready.reduce((sum, e) => sum + e.file.size, 0);
  const overTotal =
    controls && (screenshot?.size ?? 0) + readyBytes > MAX_TOTAL_BYTES;

  // A failure shows in the scrolling body, above the sticky footer on a phone.
  useEffect(() => {
    if (failure) alertBox.current?.scrollIntoView?.({ block: "nearest" });
  }, [failure]);
  const resolver = useMemo(() => resolverFor(messages.errors), [messages]);
  const { control, handleSubmit, formState } = useForm<ReportValues>({
    defaultValues: { title: "", description: "", email: "" },
    resolver,
  });

  useEffect(() => {
    if (sent) done.current?.focus();
    onDone?.(!!sent);
  }, [sent, onDone]);
  // Closing unmounts the flow: the next opening starts split again.
  useEffect(() => () => onDone?.(false), [onDone]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const fail = (error: IntakeError) => {
      setFailure(error);
      onError({ code: error.code });
    };
    if (!projectKey || !apiBase)
      return fail(new IntakeError("config", "config"));
    if (overTotal) return;
    const wait = minFillMs - (Date.now() - openedAt.current);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (aborted.current.signal.aborted) return;
    // What goes up besides the text. A screenshot too big for 5 MB is squeezed once, or left out.
    const toSend: { id: string; role: "screenshot" | "file"; file: File }[] =
      [];
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
      for (const entry of files.ready)
        toSend.push({ id: entry.id, role: "file", file: entry.file });
    const nameOf = (item: (typeof toSend)[number]) =>
      item.role === "screenshot"
        ? screenshotName(item.file.type)
        : item.file.name;
    const input: ReportInput = {
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
      website: honeypot.current?.value ?? "",
      filledInMs: Date.now() - openedAt.current,
      files: toSend.map((item) => ({
        role: item.role,
        name: nameOf(item),
        type: item.file.type,
        size: item.file.size,
      })),
    };
    try {
      const report = await submitReport({
        apiBase,
        publicKey: projectKey,
        input,
        signal: aborted.current.signal,
      });
      const progress = (id: string, percent: number) =>
        id === "screenshot"
          ? setShotRow((row) => (row ? { ...row, progress: percent } : row))
          : files.patch(id, { progress: percent });
      const first = toSend[0];
      if (first?.id === "screenshot")
        setShotRow({ id: "screenshot", file: first.file, progress: 0 });
      for (const item of toSend)
        if (item.id !== "screenshot") progress(item.id, 0);
      const results: UploadOutcome[] = await Promise.all(
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
          if (!ticket) return done({ ok: false, reason: "unknown" });
          return done(
            await putFile({
              apiBase,
              slot: ticket.slot,
              ticket: ticket.ticket,
              file: item.file,
              onProgress: (percent) => progress(item.id, percent),
              signal: aborted.current.signal,
              retryDelayMs,
            }),
          );
        }),
      );
      if (aborted.current.signal.aborted) return;
      const uploads = [...leftOut, ...results];
      setSent({ tracking: report.tracking, uploads });
      onSubmitted({
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
      if (aborted.current.signal.aborted) return;
      fail(
        error instanceof IntakeError
          ? error
          : new IntakeError("unknown", "unknown"),
      );
    }
  });

  if (sent) {
    return (
      <Confirmation
        messages={messages}
        tracking={sent.tracking}
        uploads={sent.uploads}
        doneRef={done}
        onClose={onClose}
      />
    );
  }

  return (
    <Form
      messages={messages}
      projectName={projectName}
      control={control}
      onSubmit={submit}
      onClose={onClose}
      honeypot={honeypot}
      alertBox={alertBox}
      failure={failure}
      submitting={formState.isSubmitting}
      blocked={
        failure?.kind === "rejected" || failure?.kind === "config" || overTotal
      }
      controls={controls}
      filesSection={
        controls ? (
          <AttachmentsSection
            messages={messages}
            locale={locale}
            entries={files.entries}
            screenshot={shotRow}
            locked={formState.isSubmitting}
            overTotal={overTotal}
            onDrop={(accepted, refused) =>
              files.add(accepted, refused, screenshot?.size ?? 0)
            }
            onRemove={files.remove}
          />
        ) : null
      }
      screenshot={screenshot}
      onScreenshot={setScreenshot}
      maskText={maskText}
      onEditing={onEditing}
    />
  );
}
