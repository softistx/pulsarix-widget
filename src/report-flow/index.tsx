import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  fetchWidgetConfig,
  IntakeError,
  type ReportInput,
  submitReport,
} from "../api";
import type { Locale } from "../config";
import type { Messages } from "../messages";
import { type ReportValues, resolverFor } from "../validation";
import { Confirmation } from "./confirmation";
import { Form } from "./form";

/** The API refuses a report sent faster than this after the form opened (`MIN_FILL_MS`). */
export const MIN_FILL_MS = 3_000;

export interface ReportFlowProps {
  messages: Messages;
  locale: Locale;
  projectKey: string | null;
  apiBase: string | null;
  onSubmitted: (detail: { reportId: string }) => void;
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
  useEffect(() => {
    if (!projectKey || !apiBase) return;
    const controller = new AbortController();
    void fetchWidgetConfig({
      apiBase,
      publicKey: projectKey,
      locale,
      signal: controller.signal,
    }).then((config) => {
      if (!controller.signal.aborted)
        setProjectName(config?.projectName ?? null);
    });
    return () => controller.abort();
  }, [apiBase, projectKey, locale]);
  // The flattened export of the annotated screenshot (W2c sends it); nothing else of the capture lives on.
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [sent, setSent] = useState<{ tracking: boolean } | null>(null);

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
    const wait = minFillMs - (Date.now() - openedAt.current);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (aborted.current.signal.aborted) return;
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
    };
    try {
      const report = await submitReport({
        apiBase,
        publicKey: projectKey,
        input,
        signal: aborted.current.signal,
      });
      setSent({ tracking: report.tracking });
      onSubmitted({ reportId: report.reportId });
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
      blocked={failure?.kind === "rejected" || failure?.kind === "config"}
      screenshot={screenshot}
      onScreenshot={setScreenshot}
      maskText={maskText}
      onEditing={onEditing}
    />
  );
}
