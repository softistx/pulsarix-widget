/** The report's limits (plan section 11) and the form's resolver. */
import type { FieldErrors, Resolver } from "react-hook-form";
import type { Messages } from "./messages";

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 10_000;
export const EMAIL_MAX = 254;

export interface ReportValues {
  title: string;
  description: string;
  email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(
  values: ReportValues,
  messages: Messages["errors"],
): Partial<Record<keyof ReportValues, string>> {
  const errors: Partial<Record<keyof ReportValues, string>> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  const email = values.email.trim();
  if (!title) errors.title = messages.titleRequired;
  else if (title.length > TITLE_MAX) errors.title = messages.titleTooLong;
  if (!description) errors.description = messages.descriptionRequired;
  else if (description.length > DESCRIPTION_MAX)
    errors.description = messages.descriptionTooLong;
  if (email && (!EMAIL.test(email) || email.length > EMAIL_MAX))
    errors.email = messages.emailInvalid;
  return errors;
}

export function resolverFor(
  messages: Messages["errors"],
): Resolver<ReportValues> {
  return (values) => {
    const found = validate(values, messages);
    const entries = Object.entries(found) as [keyof ReportValues, string][];
    if (entries.length === 0) return { values, errors: {} };
    const errors: FieldErrors<ReportValues> = {};
    for (const [name, message] of entries)
      errors[name] = { type: "validate", message };
    return { values: {}, errors };
  };
}
