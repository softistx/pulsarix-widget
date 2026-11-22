import {
  Alert,
  DialogBody,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { FormEventHandler, ReactNode, Ref } from "react";
import type { Control } from "react-hook-form";
import type { IntakeError } from "../../../core/api/api";
import type { Messages } from "../../../core/messages";
import { failureText } from "../model/failure-text";
import type { ReportValues } from "../model/validation";
import { FORM_ID, ReportFields } from "./fields";
import { FormFooter, FormHeader } from "./form-frame";

/** A field a person never sees; a bot that fills every field trips the API's check. */
function Honeypot({ inputRef }: { inputRef: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={inputRef}
      name="url_confirm"
      type="text"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      defaultValue=""
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );
}

/** The live region that announces a failed submit. */
function FailureAlert({
  messages,
  failure,
  alertBox,
}: {
  messages: Messages;
  failure: IntakeError | null;
  alertBox: Ref<HTMLDivElement>;
}) {
  return (
    <div role="alert" ref={alertBox} className="scroll-mb-24">
      {failure ? (
        <Alert
          variant="error"
          title={messages.failure.summary}
          description={failureText(messages, failure)}
        />
      ) : null}
    </div>
  );
}

export interface FormProps {
  messages: Messages;
  projectName: string | null;
  control: Control<ReportValues>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
  honeypot: Ref<HTMLInputElement>;
  alertBox: Ref<HTMLDivElement>;
  failure: IntakeError | null;
  submitting: boolean;
  blocked: boolean;
  /** The reporter has no identity: the form asks for an e-mail. */
  anonymous: boolean;
  /** The attachments control; null when the key or the page turned attachments off. */
  attachments: ReactNode;
  /** The screenshot editor: it takes the dialog's place while it is open. */
  editor: ReactNode;
  /** The integrator's privacy page, linked after the privacy line. */
  privacyUrl?: string | null;
}

/** The report: one form, from the title to the attachments, then Cancel and Send on one line. */
export function Form({
  messages,
  projectName,
  control,
  onSubmit,
  onClose,
  honeypot,
  alertBox,
  failure,
  submitting,
  blocked,
  anonymous,
  attachments,
  editor,
  privacyUrl,
}: FormProps) {
  if (editor)
    return (
      <>
        <DialogHeader>
          <DialogTitle>{messages.screenshot.editorLabel}</DialogTitle>
        </DialogHeader>
        <DialogBody>{editor}</DialogBody>
      </>
    );
  return (
    <>
      <FormHeader messages={messages} projectName={projectName} />
      <DialogBody role="region" aria-label={messages.title}>
        <form
          id={FORM_ID}
          onSubmit={onSubmit}
          noValidate
          className="grid gap-5"
        >
          <ReportFields
            messages={messages}
            control={control}
            anonymous={anonymous}
            privacyUrl={privacyUrl}
          />
          {attachments}
          <Honeypot inputRef={honeypot} />
          <FailureAlert
            messages={messages}
            failure={failure}
            alertBox={alertBox}
          />
        </form>
      </DialogBody>
      <FormFooter
        messages={messages}
        onClose={onClose}
        submitting={submitting}
        blocked={blocked}
      />
    </>
  );
}
