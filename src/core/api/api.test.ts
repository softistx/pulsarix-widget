import { describe, expect, test } from "bun:test";
import { type IntakeError, publicCall } from "./api";

function failing(status: number, code: string | undefined, message: string) {
  return (async () =>
    new Response(
      JSON.stringify({
        errors: [{ message, extensions: code ? { code } : {} }],
      }),
      { status },
    )) as unknown as typeof fetch;
}

async function caught(doFetch: typeof fetch): Promise<IntakeError> {
  try {
    await publicCall({
      apiBase: "https://api.test",
      id: "markRequestRead",
      variables: { publicKey: "pk", id: "1" },
      locale: "en",
      fetch: doFetch,
    });
  } catch (error) {
    return error as IntakeError;
  }
  throw new Error("publicCall did not throw");
}

describe("publicCall refusals", () => {
  test("keeps the API's message for an intake code", async () => {
    const error = await caught(
      failing(400, "intake.errors.reopen-expired", "Too old."),
    );
    expect(error.apiMessage).toBe("Too old.");
  });

  test("keeps the API's message for a validation code", async () => {
    const error = await caught(
      failing(400, "validation.errors.invalid-input", "Title is required."),
    );
    expect(error.kind).toBe("invalid");
    expect(error.apiMessage).toBe("Title is required.");
  });

  test("keeps no message when the failure has no code", async () => {
    const error = await caught(failing(500, undefined, "boom"));
    expect(error.kind).toBe("unknown");
    expect(error.apiMessage).toBeUndefined();
  });

  test("keeps no message for an identity refusal without an intake code", async () => {
    const error = await caught(failing(401, "unauthenticated", "Nope."));
    expect(error.kind).toBe("identity");
    expect(error.apiMessage).toBeUndefined();
  });
});
