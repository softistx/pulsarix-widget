import type { IntakeError } from "../api";
import type { RequestsMessages } from "./messages";

/** The words of a failed read; the API's own code is never shown. */
export function errorText(text: RequestsMessages, error: IntakeError): string {
  switch (error.kind) {
    case "identity":
      return text.errors.identity;
    case "unavailable":
      return text.errors.unavailable;
    case "rate-limited":
      return text.errors.rateLimited;
    case "network":
      return text.errors.network;
    default:
      return text.errors.unknown;
  }
}

/** A thread's failure words: its own codes first, then the generic ones. */
export function threadErrorText(
  text: RequestsMessages,
  error: IntakeError,
): string {
  const t = text.thread;
  if (error.code.endsWith("reopen-expired")) return t.errors.reopenExpired;
  if (error.code.endsWith("request-declined")) return t.errors.declined;
  if (error.kind === "files") return t.errors.files;
  return errorText(text, error);
}
