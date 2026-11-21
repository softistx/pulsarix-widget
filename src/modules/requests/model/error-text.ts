import type { IntakeError } from "../../../core/api/api";
import type { RequestsMessages } from "./messages";

/**
 * The words of a failed call: the API's own message for a `*.errors.*`
 * code, else the widget's for a lapsed session (the stream's own failure), the
 * busy service, the network and unknown.
 */
export function errorText(text: RequestsMessages, error: IntakeError): string {
  if (error.apiMessage) return error.apiMessage;
  switch (error.kind) {
    case "identity":
      return text.errors.identity;
    case "rate-limited":
      return text.errors.rateLimited(Math.max(1, error.minutes ?? 1));
    case "unavailable":
      return text.errors.unavailable;
    case "network":
      return text.errors.network;
    default:
      return text.errors.unknown;
  }
}

/** A thread's failure words: the same as any call's (the API words its codes). */
export const threadErrorText = errorText;
