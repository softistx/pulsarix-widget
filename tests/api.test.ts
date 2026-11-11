import { expect, test } from "bun:test";
import { IntakeError, submitReport } from "../src/api";

const input = {
  title: "t",
  description: "d",
  email: "",
  locale: "en",
  website: "",
  filledInMs: 4000,
};
const base = { apiBase: "https://p.test/", publicKey: "pk", input };

test("an empty e-mail is left out of the request", async () => {
  let body: { variables: { input: object } } | undefined;
  const result = await submitReport({
    ...base,
    fetch: (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({
          data: { submitClientReport: { reportId: "x", tracking: false } },
        }),
      );
    }) as unknown as typeof fetch,
  });
  expect(result).toEqual({ reportId: "x", tracking: false });
  expect(body?.variables.input).not.toHaveProperty("email");
});

test("an answer that is not JSON is an unknown failure with its status", async () => {
  const error = await submitReport({
    ...base,
    fetch: (async () =>
      new Response("<html>", { status: 502 })) as unknown as typeof fetch,
  }).catch((e) => e);
  expect(error).toBeInstanceOf(IntakeError);
  expect(error.kind).toBe("unknown");
  expect(error.code).toBe("http-502");
});
