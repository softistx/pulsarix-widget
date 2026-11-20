import { IntakeError } from "../api";

/** Any thrown value as an `IntakeError` (an unknown one becomes `unknown`). */
export const failure = (error: unknown): IntakeError =>
  error instanceof IntakeError ? error : new IntakeError("unknown", "unknown");
