import { describe, expect, test } from "bun:test";
import { IntakeError } from "../../../core/api/api";
import { MESSAGES } from "../../../core/messages";
import { failureText } from "./failure-text";

const messages = MESSAGES.en;

describe("failureText", () => {
  test("shows the API's message when it gave one", () => {
    const error = new IntakeError(
      "invalid",
      "validation.errors.invalid-input",
      undefined,
      "Title is required.",
    );
    expect(failureText(messages, error)).toBe("Title is required.");
  });

  test("words a failure with no API message in its own words", () => {
    expect(failureText(messages, new IntakeError("network", "network"))).toBe(
      messages.failure.network,
    );
    expect(failureText(messages, new IntakeError("unknown", "x"))).toBe(
      messages.failure.unknown,
    );
  });
});
