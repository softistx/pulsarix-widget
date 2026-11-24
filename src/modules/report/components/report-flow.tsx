import { useEffect, useRef, useState } from "react";
import type { IntakeError } from "../../../core/api/api";
import { type Entry, useAttachments } from "../../files/hooks/use-attachments";
import { MAX_TOTAL_BYTES, screenshotName } from "../../files/model/rules";
import { EditorHost } from "../../screenshot/components/editor-host";
import { usePane } from "../../screenshot/hooks/use-pane";
import { useProject } from "../hooks/use-project";
import { useReportForm } from "../hooks/use-report-form";
import { pageOf } from "../model/send";
import { runSubmit } from "../model/submit";
import { MIN_FILL_MS, type ReportFlowProps } from "../model/types";
import { AttachmentsControl } from "./attachments";
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
  onEditing,
  onDone,
  onRequests,
  minFillMs = MIN_FILL_MS,
  maskText = false,
  attachments = true,
  retryDelayMs,
  prefill,
  metadata,
  privacyUrl,
  draft,
  identity,
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
  });
  const [sent, setSent] = useState<{
    tracking: boolean;
    uploads: UploadOutcome[];
  } | null>(null);
  const files = useAttachments(messages.files);
  const pane = usePane(messages, maskText, onEditing);
  // Captures and files are one list, each removable; every image can be edited again.
  const items: Entry[] = files.entries;
  const readyBytes = files.ready.reduce((sum, e) => sum + e.file.size, 0);
  const overTotal = controls && readyBytes > MAX_TOTAL_BYTES;

  // A failure shows in the scrolling body, above the sticky footer on a phone.
  useEffect(() => {
    if (failure) alertBox.current?.scrollIntoView?.({ block: "nearest" });
  }, [failure]);
  // A rate limit holds Send off for the wait the alert names, then lets the person send again.
  // `minutes` may be absent from the API's refusal: wait one minute then, never zero.
  useEffect(() => {
    if (failure?.kind !== "rate-limited") return;
    const timer = setTimeout(
      () => setFailure(null),
      Math.max(1, failure.minutes ?? 1) * 60_000,
    );
    return () => clearTimeout(timer);
  }, [failure]);
  const { control, handleSubmit, formState } = useReportForm({
    messages,
    draft,
    prefill,
  });

  useEffect(() => {
    if (sent) done.current?.focus();
  }, [sent]);
  useEffect(() => {
    onDone?.(!!sent);
    return () => onDone?.(false);
  }, [sent, onDone]);

  const submit = handleSubmit((values) =>
    runSubmit(values, {
      messages,
      locale,
      projectKey,
      apiBase,
      controls,
      overTotal,
      ready: files.ready,
      patch: files.patch,
      metadata,
      identity,
      draft,
      minFillMs,
      retryDelayMs,
      openedAt: openedAt.current,
      honeypot: honeypot.current?.value ?? "",
      signal: aborted.current.signal,
      setFailure,
      setSent,
      onSubmitted,
      onError,
    }),
  );

  if (sent) {
    return (
      <Confirmation
        messages={messages}
        tracking={sent.tracking}
        uploads={sent.uploads}
        doneRef={done}
        onClose={onClose}
        onRequests={onRequests}
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
        failure?.kind === "rejected" ||
        failure?.kind === "config" ||
        failure?.kind === "rate-limited" ||
        overTotal
      }
      anonymous={!identity}
      attachments={
        controls ? (
          <AttachmentsControl
            messages={messages}
            locale={locale}
            region={pane.region}
            items={items}
            locked={formState.isSubmitting}
            overTotal={overTotal}
            canCapture={pane.canCapture}
            busy={pane.busy}
            notice={pane.notice}
            maskText={pane.maskText}
            onMaskText={pane.setMaskText}
            onCapture={() =>
              void pane.capture((blob) => {
                const page = pageOf();
                const entry = files.addCapture(
                  new File([blob], screenshotName(blob.type), {
                    type: blob.type,
                  }),
                  page ?? "",
                );
                if (entry) pane.setEdit({ id: entry.id, source: blob });
                else pane.setNotice(messages.files.count);
              })
            }
            onDrop={(accepted, refused) => {
              const added = files.add(accepted, refused);
              // An uploaded image opens in the editor right away, like a capture.
              const image = added.find((e) => e.file.type.startsWith("image/"));
              if (image) pane.setEdit({ id: image.id, source: image.file });
            }}
            onEdit={(id) => {
              const entry = files.entries.find((e) => e.id === id);
              if (entry) pane.setEdit({ id, source: entry.file });
            }}
            onRemove={files.remove}
          />
        ) : null
      }
      editor={
        pane.edit ? (
          <EditorHost
            messages={messages}
            source={pane.edit.source}
            pageUrl={files.entries.find((e) => e.id === pane.edit?.id)?.pageUrl}
            onSave={(file) => {
              const editing = pane.edit;
              pane.setEdit(null);
              const entry = files.entries.find((e) => e.id === editing?.id);
              if (editing && entry)
                files.patch(editing.id, {
                  file:
                    entry.pageUrl === undefined
                      ? new File(
                          [file],
                          `${entry.file.name.replace(/\.[^.]+$/, "")}.png`,
                          { type: file.type },
                        )
                      : file,
                });
              pane.focusRegion();
            }}
            onCancel={() => {
              pane.setEdit(null);
              pane.focusRegion();
            }}
          />
        ) : null
      }
      privacyUrl={privacyUrl}
    />
  );
}
