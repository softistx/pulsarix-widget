import { Alert, DialogAside, DialogBody } from "@softistx/material/embed";
import type { FormEventHandler, ReactNode, Ref } from "react";
import type { Control } from "react-hook-form";
import type { IntakeError } from "../../../core/api/api";
import type { Messages } from "../../../core/messages";
import { ScreenshotPane } from "../../screenshot/components/pane";
import { failureText } from "../model/failure-text";
import type { ReportValues } from "../model/validation";
import { FormFooter, FormHeader } from "./form-frame";
import {
  ContactSection,
  DetailsSection,
  FORM_ID,
  FormSection,
  ProblemSection,
} from "./form-sections";

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
  /** The screenshot pane and the files section show (the key and the page allow them). */
  controls: boolean;
  filesSection: ReactNode;
  screenshot: File | null;
  onScreenshot: (image: File | null) => void;
  maskText: boolean;
  onEditing?: (editing: boolean) => void;
  /** The integrator's privacy page, linked after the privacy line. */
  privacyUrl?: string | null;
  /** In the header under the description: the identified reporter's tabs. */
  headerExtra?: ReactNode;
}

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
  controls,
  filesSection,
  screenshot,
  onScreenshot,
  maskText,
  onEditing,
  privacyUrl,
  headerExtra,
}: FormProps) {
  return (
    <>
      <FormHeader
        messages={messages}
        projectName={projectName}
        headerExtra={headerExtra}
      />
      <DialogBody role="region" aria-label={messages.title}>
        <form
          id={FORM_ID}
          onSubmit={onSubmit}
          noValidate
          className="grid gap-6"
        >
          <ProblemSection messages={messages} control={control} />
          <hr className="border-border border-t" />
          <DetailsSection messages={messages} control={control} />
          <hr className="border-border border-t" />
          {controls ? (
            <>
              <FormSection id="files" title={messages.sections.files}>
                {filesSection}
              </FormSection>
              <hr className="border-border border-t" />
            </>
          ) : null}
          <ContactSection
            messages={messages}
            control={control}
            privacyUrl={privacyUrl}
          />
          <Honeypot inputRef={honeypot} />
          <FailureAlert
            messages={messages}
            failure={failure}
            alertBox={alertBox}
          />
        </form>
      </DialogBody>
      {controls ? (
        <DialogAside aria-label={messages.aside.title}>
          <ScreenshotPane
            messages={messages}
            image={screenshot}
            onImage={onScreenshot}
            maskTextDefault={maskText}
            onEditingChange={onEditing}
          />
        </DialogAside>
      ) : null}
      <FormFooter
        messages={messages}
        onClose={onClose}
        submitting={submitting}
        blocked={blocked}
      />
    </>
  );
}
