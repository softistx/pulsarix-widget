import {
  ChipGroupField,
  EmailFormField,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import type { ReactNode } from "react";
import { type Control, Controller } from "react-hook-form";
import type { Messages } from "../messages";
import {
  DESCRIPTION_MAX,
  EMAIL_MAX,
  type ReportValues,
  TITLE_MAX,
} from "../validation";

export const FORM_ID = "pulsarix-report-form";
const TYPES = ["bug", "question", "suggestion"] as const;
const IMPACTS = ["blocking", "annoying", "minor"] as const;

interface SectionProps {
  messages: Messages;
  control: Control<ReportValues>;
}

/** A titled group of the form, named by its heading. */
export function FormSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${FORM_ID}-${id}`}
      className="grid content-start gap-4"
    >
      <h3
        id={`${FORM_ID}-${id}`}
        className="font-semibold text-foreground text-sm"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ProblemSection({ messages, control }: SectionProps) {
  return (
    <FormSection id="problem" title={messages.sections.problem}>
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
    </FormSection>
  );
}

/** Single-choice and optional: chips on a full row, pressing the chosen one clears it. */
function ChoiceChips<N extends "type" | "impact">({
  name,
  values,
  messages,
  control,
}: SectionProps & { name: N; values: readonly string[] }) {
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
          options={values.map((value) => ({
            value,
            label: (messages.choices[name] as Record<string, string>)[value],
          }))}
        />
      )}
    />
  );
}

export function DetailsSection({ messages, control }: SectionProps) {
  return (
    <FormSection id="details" title={messages.sections.details}>
      <ChoiceChips
        name="type"
        values={TYPES}
        messages={messages}
        control={control}
      />
      <ChoiceChips
        name="impact"
        values={IMPACTS}
        messages={messages}
        control={control}
      />
    </FormSection>
  );
}

export function ContactSection({
  messages,
  control,
  privacyUrl,
}: SectionProps & { privacyUrl?: string | null }) {
  return (
    <FormSection id="contact" title={messages.sections.contact}>
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
      </div>
    </FormSection>
  );
}
