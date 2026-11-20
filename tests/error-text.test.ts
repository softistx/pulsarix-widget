import { describe, expect, test } from "bun:test";
import { IntakeError } from "../src/api";
import { errorText, threadErrorText } from "../src/requests/error-text";
import { REQUESTS_MESSAGES } from "../src/requests/messages";

const text = REQUESTS_MESSAGES.en;

describe("threadErrorText", () => {
  test("names the thread's own codes first", () => {
    const expired = new IntakeError("unknown", "x.reopen-expired");
    expect(threadErrorText(text, expired)).toBe(
      text.thread.errors.reopenExpired,
    );
    const declined = new IntakeError("unknown", "x.request-declined");
    expect(threadErrorText(text, declined)).toBe(text.thread.errors.declined);
    expect(threadErrorText(text, new IntakeError("files", "files"))).toBe(
      text.thread.errors.files,
    );
  });

  test("falls back to the generic words", () => {
    const error = new IntakeError("network", "network");
    expect(threadErrorText(text, error)).toBe(errorText(text, error));
  });
});
