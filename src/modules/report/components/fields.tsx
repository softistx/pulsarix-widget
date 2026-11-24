import {
  ChipGroupField,
  EmailFormField,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import type { ComponentProps, ReactNode } from "react";
import { type Control, Controller } from "react-hook-form";
import type { Messages } from "../../../core/messages";
import {
  DESCRIPTION_MAX,
  EMAIL_MAX,
  type ReportValues,
  TITLE_MAX,
} from "../model/validation";

export const FORM_ID = "pulsarix-report-form";

interface FieldsProps {
  messages: Messages;
  control: Control<ReportValues>;
}

/** Single-choice and optional: chips on a full row, pressing the chosen one clears it. */
// The severity reads at a glance: blocking is an error, annoying a warning, minor neutral.
const TONES: Record<string, "error" | "warning" | undefined> = {
  blocking: "error",
  annoying: "warning",
};

function ChoiceChips({
  name,
  messages,
  control,
}: FieldsProps & { name: "type" | "impact" }) {
  const labels: Record<string, string> = messages.choices[name];
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChipGroupField
          label={messages.fields[name]}
          deselectable
          columns={3}
          value={field.value || null}
          onValueChange={(value) => field.onChange(value ?? "")}
          options={Object.entries(labels).map(([value, label]) => ({
            value,
            label,
            tone: TONES[value],
          }))}
        />
      )}
    />
  );
}

/** A titled group of the form; the rule above it separates it from the group before. */
export function FormGroup({
  title,
  hint,
  titleId,
  flush,
  children,
  ...rest
}: {
  title?: string;
  hint?: string;
  titleId?: string;
  /** The first group of the form: no rule above it. */
  flush?: boolean;
  children: ReactNode;
} & Omit<ComponentProps<"section">, "title" | "children">) {
  return (
    <section
      {...rest}
      aria-labelledby={title ? titleId : undefined}
      className={`grid gap-3 ${flush ? "" : "border-border border-t pt-6"}`}
    >
      {title ? (
        <div className="grid gap-0.5">
          <h3 id={titleId} className="font-semibold text-foreground text-sm">
            {title}
          </h3>
          {hint ? (
            <p className="text-muted-foreground text-sm">{hint}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The whole report, in the order it is told: title, description, type, impact, then the e-mail. */
export function ReportFields({
  messages,
  control,
  anonymous,
}: FieldsProps & {
  /** No identity: the reporter may leave an e-mail to get the link to follow the report. */
  anonymous: boolean;
}) {
  return (
    <>
      <FormGroup flush>
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
        {anonymous ? (
          <EmailFormField
            control={control}
            name="email"
            inputMode="email"
            label={messages.fields.email}
            helperText={messages.fields.emailHint}
            maxLength={EMAIL_MAX}
            autoComplete="email"
          />
        ) : null}
      </FormGroup>
      <FormGroup>
        <ChoiceChips name="type" messages={messages} control={control} />
        <ChoiceChips name="impact" messages={messages} control={control} />
      </FormGroup>
    </>
  );
}

/** What is sent with a report, and the link to the integrator's privacy page. */
export function PrivacyNote({
  messages,
  privacyUrl,
}: {
  messages: Messages;
  privacyUrl?: string | null;
}) {
  return (
    <p className="border-border border-t pt-6 text-muted-foreground text-sm">
      {messages.privacy}
      {privacyUrl ? (
        <>
          {" "}
          <a
            href={privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-text underline"
          >
            {messages.privacyLink}
          </a>
        </>
      ) : null}
    </p>
  );
}
