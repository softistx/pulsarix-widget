import {
  Alert,
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { IntakeError, type ReportInput, submitReport } from "./api";
import type { Locale } from "./config";
import type { Messages } from "./messages";
import {
  DESCRIPTION_MAX,
  EMAIL_MAX,
  type ReportValues,
  resolverFor,
  TITLE_MAX,
} from "./validation";

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
  /** Overridable for specs; the API's own minimum otherwise. */
  minFillMs?: number;
}

function failureText(messages: Messages, error: IntakeError): string {
  const text = messages.failure;
  switch (error.kind) {
    case "config":
      return text.config;
    case "rejected":
      return text.rejected;
    case "unavailable":
      return text.unavailable;
    case "rate-limited":
      return text.rateLimited(
        Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)),
      );
    case "invalid":
      return text.invalid;
    case "network":
      return text.network;
    default:
      return text.unknown;
  }
}

/**
 * The dialog's content: the report form, then the confirmation. It lives inside the
 * dialog's popup, so closing the dialog unmounts it and the next opening starts blank.
 */
const FORM_ID = "pulsarix-report-form";

export function ReportFlow({
  messages,
  locale,
  projectKey,
  apiBase,
  onSubmitted,
  onError,
  onClose,
  minFillMs = MIN_FILL_MS,
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
  }, [sent]);

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
      // Without the fragment: it can carry a host page's tokens.
      pageUrl: location.href.split("#")[0]?.slice(0, 2_048),
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
      <>
        <DialogHeader>
          <DialogTitle>{messages.done.title}</DialogTitle>
          <DialogDescription>{messages.done.body}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div ref={done} tabIndex={-1} role="status" className="outline-none">
            <Alert
              variant="success"
              description={
                sent.tracking
                  ? messages.done.tracking
                  : messages.done.noTracking
              }
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{messages.close}</Button>
        </DialogFooter>
      </>
    );
  }

  const blocked = failure?.kind === "rejected" || failure?.kind === "config";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{messages.title}</DialogTitle>
        <DialogDescription>{messages.intro}</DialogDescription>
      </DialogHeader>
      <DialogBody className="min-h-0 flex-1 overflow-y-auto">
        <form
          id={FORM_ID}
          onSubmit={submit}
          noValidate
          className="grid content-start gap-4"
        >
          <TextFormField
            control={control}
            name="title"
            label={messages.fields.title}
            helperText={messages.fields.titleHint}
            maxLength={TITLE_MAX}
            autoComplete="off"
            required
          />
          <TextareaFormField
            control={control}
            name="description"
            label={messages.fields.description}
            helperText={messages.fields.descriptionHint}
            minRows={4}
            maxRows={10}
            maxLength={DESCRIPTION_MAX}
            required
          />
          <TextFormField
            control={control}
            name="email"
            type="email"
            inputMode="email"
            label={messages.fields.email}
            helperText={messages.fields.emailHint}
            maxLength={EMAIL_MAX}
            autoComplete="email"
          />
          {/* Honeypot: a person never sees it; a bot that fills every field trips the API's check. */}
          <input
            ref={honeypot}
            name="url_confirm"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            defaultValue=""
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <div role="alert" ref={alertBox}>
            {failure ? (
              <Alert
                variant="error"
                title={messages.failure.summary}
                description={failureText(messages, failure)}
              />
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">{messages.privacy}</p>
        </form>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="tonal" onClick={onClose}>
          {messages.close}
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          loading={formState.isSubmitting}
          disabled={blocked}
        >
          {formState.isSubmitting ? messages.submitting : messages.submit}
        </Button>
      </DialogFooter>
    </>
  );
}
