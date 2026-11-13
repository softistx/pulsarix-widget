import type { IntakeError } from "../api";
import type { Messages } from "../messages";

export function failureText(messages: Messages, error: IntakeError): string {
  const text = messages.failure;
  switch (error.kind) {
    case "config":
      return text.config;
    case "rejected":
      return text.rejected;
    case "unavailable":
      return text.unavailable;
    case "rate-limited":
      return text.rateLimited(
        Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60)),
      );
    case "invalid":
      return text.invalid;
    case "network":
      return text.network;
    default:
      return text.unknown;
  }
}
