import type { IntakeError } from "../api";
import type { Messages } from "../messages";

/**
 * The API words its own `intake.errors.*` refusals (in the request's language);
 * the widget words only what the API cannot: config, network, a busy or
 * unreachable service, a wait with no API message, and unknown.
 */
export function failureText(messages: Messages, error: IntakeError): string {
  if (error.apiMessage) return error.apiMessage;
  const text = messages.failure;
  switch (error.kind) {
    case "config":
    case "rejected":
      return text.config;
    case "unavailable":
      return text.unavailable;
    case "rate-limited":
      return text.rateLimited(Math.max(1, error.minutes ?? 1));
    case "network":
      return text.network;
    default:
      return text.unknown;
  }
}
