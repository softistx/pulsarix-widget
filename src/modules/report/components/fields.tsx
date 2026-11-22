import {
  ChipGroupField,
  EmailFormField,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
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
function ChoiceChips({
  name,
  labels,
  messages,
  control,
}: FieldsProps & {
  name: "type" | "impact";
  /** The chip labels by value, in display order. */
  labels: Record<string, string>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChipGroupField
          label={messages.fields[name]}
          deselectable
          value={field.value || null}
          onValueChange={(value) => field.onChange(value ?? "")}
          options={Object.entries(labels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      )}
    />
  );
}

/** The whole report, in the order it is told: title, description, type, impact, then the e-mail. */
export function ReportFields({
  messages,
  control,
  anonymous,
  privacyUrl,
}: FieldsProps & {
  /** No identity: the reporter may leave an e-mail to get the link to follow the report. */
  anonymous: boolean;
  privacyUrl?: string | null;
}) {
  return (
    <>
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
      <ChoiceChips
        name="type"
        labels={messages.choices.type}
        messages={messages}
        control={control}
      />
      <ChoiceChips
        name="impact"
        labels={messages.choices.impact}
        messages={messages}
        control={control}
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
      <p className="text-muted-foreground text-xs">
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
    </>
  );
}
