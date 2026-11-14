import {
  Alert,
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmailFormField,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import type { FormEventHandler, Ref } from "react";
import type { Control } from "react-hook-form";
import type { IntakeError } from "../api";
import type { Messages } from "../messages";
import {
  DESCRIPTION_MAX,
  EMAIL_MAX,
  type ReportValues,
  TITLE_MAX,
} from "../validation";
import { failureText } from "./failure-text";

const FORM_ID = "pulsarix-report-form";

export function Form({
  messages,
  control,
  onSubmit,
  onClose,
  honeypot,
  alertBox,
  failure,
  submitting,
  blocked,
}: {
  messages: Messages;
  control: Control<ReportValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
  honeypot: Ref<HTMLInputElement>;
  alertBox: Ref<HTMLDivElement>;
  failure: IntakeError | null;
  submitting: boolean;
  blocked: boolean;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{messages.title}</DialogTitle>
        <DialogDescription>{messages.intro}</DialogDescription>
      </DialogHeader>
      <DialogBody className="min-h-0 flex-1 overflow-y-auto">
        <form
          id={FORM_ID}
          onSubmit={onSubmit}
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
          <EmailFormField
            control={control}
            name="email"
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
          loading={submitting}
          disabled={blocked}
        >
          {submitting ? messages.submitting : messages.submit}
        </Button>
      </DialogFooter>
    </>
  );
}
