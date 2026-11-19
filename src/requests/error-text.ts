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
