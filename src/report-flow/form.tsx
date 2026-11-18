import {
  Alert,
  Button,
  DialogAside,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmailFormField,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import type { FormEventHandler, ReactNode, Ref } from "react";
import type { Control } from "react-hook-form";
import type { IntakeError } from "../api";
import type { Messages } from "../messages";
import { ScreenshotPane } from "../screenshot/pane";
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
}: {
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
}) {
  return (
    <>
      <DialogHeader>
        {projectName ? (
          <p
            data-testid="project-name"
            className="font-semibold text-primary-text text-xs uppercase tracking-wide"
          >
            {projectName}
          </p>
        ) : null}
        <DialogTitle>{messages.title}</DialogTitle>
        <DialogDescription>
          {projectName ? messages.introFor(projectName) : messages.intro}
        </DialogDescription>
      </DialogHeader>
      <DialogBody aria-label={messages.title}>
        <form
          id={FORM_ID}
          onSubmit={onSubmit}
          noValidate
          className="grid gap-6"
        >
          <section
            aria-labelledby={`${FORM_ID}-problem`}
            className="grid content-start gap-4"
          >
            <h3
              id={`${FORM_ID}-problem`}
              className="font-semibold text-foreground text-sm"
            >
              {messages.sections.problem}
            </h3>
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
          </section>
          <hr className="border-border border-t" />
          {controls ? (
            <>
              <section
                aria-labelledby={`${FORM_ID}-files`}
                className="grid content-start gap-4"
              >
                <h3
                  id={`${FORM_ID}-files`}
                  className="font-semibold text-foreground text-sm"
                >
                  {messages.sections.files}
                </h3>
                {filesSection}
              </section>
              <hr className="border-border border-t" />
            </>
          ) : null}
          <section
            aria-labelledby={`${FORM_ID}-contact`}
            className="grid content-start gap-4"
          >
            <h3
              id={`${FORM_ID}-contact`}
              className="font-semibold text-foreground text-sm"
            >
              {messages.sections.contact}
            </h3>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <EmailFormField
                control={control}
                name="email"
                inputMode="email"
                label={messages.fields.email}
                helperText={messages.fields.emailHint}
                maxLength={EMAIL_MAX}
                autoComplete="email"
              />
              <p className="text-muted-foreground text-xs sm:pt-6">
                {messages.privacy}
              </p>
            </div>
          </section>
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
          {messages.submit}
        </Button>
      </DialogFooter>
    </>
  );
}
