import { useEffect, useRef, useState } from "react";
import { IntakeError } from "../../../core/api/api";
import { AttachmentsSection } from "../../files/components/section";
import { type Entry, useAttachments } from "../../files/hooks/use-attachments";
import { MAX_TOTAL_BYTES, screenshotName } from "../../files/model/rules";
import { submitReport } from "../api";
import { useProject } from "../hooks/use-project";
import { useReportForm } from "../hooks/use-report-form";
import { buildInput, collectUploads, uploadAll } from "../model/send";
import { MIN_FILL_MS, type ReportFlowProps } from "../model/types";
import { Confirmation, type UploadOutcome } from "./confirmation";
import { Form } from "./form";

export {
  MIN_FILL_MS,
  type ReportFlowProps,
  type SubmitDetail,
} from "../model/types";

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
  onSubmitting,
  onEditing,
  minFillMs = MIN_FILL_MS,
  maskText = false,
  attachments = true,
  onControls,
  retryDelayMs,
  prefill,
  metadata,
  privacyUrl,
  draft,
  identity,
  headerExtra,
  project,
  onProject,
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
  const { projectName, controls } = useProject({
    apiBase,
    projectKey,
    locale,
    project,
    attachments,
    onProject,
    onControls,
  });
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
  const { control, handleSubmit, formState } = useReportForm({
    messages,
    draft,
    prefill,
  });

  useEffect(() => {
    if (sent) done.current?.focus();
    onDone?.(!!sent);
  }, [sent, onDone]);
  const submitting = formState.isSubmitting;
  useEffect(() => {
    onSubmitting?.(submitting);
  }, [submitting, onSubmitting]);
  useEffect(() => () => onSubmitting?.(false), [onSubmitting]);
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
    const { toSend, leftOut } = await collectUploads({
      controls,
      screenshot,
      ready: files.ready,
      messages,
    });
    const input = buildInput({
      values,
      locale,
      metadata,
      honeypot: honeypot.current?.value ?? "",
      filledInMs: Date.now() - openedAt.current,
      toSend,
    });
    try {
      const report = await submitReport({
        apiBase,
        publicKey: projectKey,
        input,
        identity,
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
      const results = await uploadAll({
        apiBase,
        report,
        toSend,
        messages,
        onProgress: progress,
        signal: aborted.current.signal,
        retryDelayMs,
      });
      // A close before submitReport resolves aborts it and emits nothing (accepted: the
      // report may not exist). From here on the report is saved: `pulsarix:submit` fires once even if the dialog closed during
      // the PUTs (those were aborted and read as not uploaded); only the confirmation is skipped.
      const uploads = [...leftOut, ...results];
      // The report exists: the draft is spent, whether or not the dialog is still open.
      if (draft) draft.current = null;
      if (!aborted.current.signal.aborted)
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
      privacyUrl={privacyUrl}
      headerExtra={headerExtra}
    />
  );
}
