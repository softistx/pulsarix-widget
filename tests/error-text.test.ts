import { describe, expect, test } from "bun:test";
import { IntakeError } from "../src/api";
import { errorText, threadErrorText } from "../src/requests/error-text";
import { REQUESTS_MESSAGES } from "../src/requests/messages";

const text = REQUESTS_MESSAGES.en;

describe("errorText", () => {
  test("shows the API's own message when it gave one", () => {
    const error = new IntakeError(
      "unknown",
      "intake.errors.reopen-expired",
      undefined,
      "Too old to reopen.",
    );
    expect(errorText(text, error)).toBe("Too old to reopen.");
    expect(threadErrorText(text, error)).toBe("Too old to reopen.");
  });

  test("words a lapsed session (no API message) in its own words", () => {
    expect(errorText(text, new IntakeError("identity", "http-401"))).toBe(
      text.errors.identity,
    );
  });

  test("words only the busy service, the network and the unknown", () => {
    expect(errorText(text, new IntakeError("unavailable", "http-503"))).toBe(
      text.errors.unavailable,
    );
    expect(errorText(text, new IntakeError("network", "network"))).toBe(
      text.errors.network,
    );
    expect(errorText(text, new IntakeError("invalid", "http-400"))).toBe(
      text.errors.unknown,
    );
  });
});
