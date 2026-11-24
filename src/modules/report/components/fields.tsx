import {
  ChoiceCardGroupFormField,
  EmailFormField,
  FormCell,
  FormSection,
  TextareaFormField,
  TextFormField,
} from "@softistx/material/embed";
import type { ReactNode, Ref } from "react";
import type { Control } from "react-hook-form";
import type { Messages } from "../../../core/messages";
import {
  DESCRIPTION_MAX,
  EMAIL_MAX,
  type ReportValues,
  TITLE_MAX,
} from "../model/validation";
import { CHOICE_ICONS } from "./choice-icons";

export const FORM_ID = "pulsarix-report-form";

interface FieldsProps {
  messages: Messages;
  control: Control<ReportValues>;
}

/**
 * Single-choice and optional: cards in up to three columns (one on a phone, from the dialog's own width), pressing the chosen one clears it. Each field spans
 * the full row of the form grid, so Type and Gravité never share a row on wide screens.
 */
function ChoiceCards({
  name,
  messages,
  control,
}: FieldsProps & { name: "type" | "impact" }) {
  const labels: Record<string, string> = messages.choices[name];
  const hints: Record<string, string> = messages.choiceHints[name];
  return (
    <FormCell span="full">
      <ChoiceCardGroupFormField
        control={control}
        name={name}
        label={messages.fields[name]}
        deselectable
        columns={3}
        options={Object.entries(labels).map(([value, title]) => ({
          value,
          title,
          description: hints[value],
          icon: CHOICE_ICONS[value],
        }))}
      />
    </FormCell>
  );
}

/** A titled section of the form; the rule above it separates it from the section before. */
export function Section({
  title,
  description,
  children,
  ...rest
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
  role?: string;
  tabIndex?: number;
  body?: "grid" | "stack";
  columns?: 1 | 2 | 3;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <FormSection
      {...rest}
      variant="heading"
      titleAs="h3"
      title={title ?? ""}
      description={description}
      separated={!!title}
    >
      {children}
    </FormSection>
  );
}

/** The whole report, in the order it is told: title, description, type, impact, then the e-mail. */
export function ReportFields({ messages, control }: FieldsProps) {
  return (
    <Section title={messages.fields.details} columns={2}>
      <FormCell span="full">
        <TextFormField
          control={control}
          name="title"
          label={messages.fields.title}
          helperText={messages.fields.titleHint}
          maxLength={TITLE_MAX}
          autoComplete="off"
          required
        />
      </FormCell>
      <FormCell span="full">
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
      </FormCell>
      <ChoiceCards name="type" messages={messages} control={control} />
      <ChoiceCards name="impact" messages={messages} control={control} />
    </Section>
  );
}

/** The last section of an anonymous report: the optional e-mail, with its privacy line. */
export function ContactFields({
  messages,
  control,
  privacyUrl,
}: FieldsProps & { privacyUrl?: string | null }) {
  return (
    <Section
      title={messages.fields.contact}
      description={<PrivacyNote messages={messages} privacyUrl={privacyUrl} />}
      columns={2}
    >
      <FormCell>
        <EmailFormField
          control={control}
          name="email"
          inputMode="email"
          label={messages.fields.email}
          helperText={messages.fields.emailHint}
          maxLength={EMAIL_MAX}
          autoComplete="email"
        />
      </FormCell>
    </Section>
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
    <>
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
    </>
  );
}
