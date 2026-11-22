import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { IntakeError } from "../../../core/api/api";
import { MESSAGES } from "../../../core/messages";
import { runSubmit, type SubmitContext } from "./submit";
import type { ReportValues } from "./validation";

const values: ReportValues = {
  title: "Broken",
  description: "It does not save",
  email: "",
  type: "",
  impact: "",
};
const realFetch = globalThis.fetch;
let sent = 0;

beforeEach(() => {
  sent = 0;
  globalThis.fetch = mock(async () => {
    sent += 1;
    return new Response(
      JSON.stringify({
        data: {
          submitClientReport: { reportId: "r1", tracking: true, files: [] },
        },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

function context(over: Partial<SubmitContext> = {}) {
  const calls = {
    failure: [] as (IntakeError | null)[],
    sent: [] as unknown[],
    submitted: [] as unknown[],
    errors: [] as { code: string }[],
  };
  const draft = { current: values as ReportValues | null };
  const ctx: SubmitContext = {
    messages: MESSAGES.en,
    locale: "en",
    projectKey: "pk_test",
    apiBase: "https://api.test/graphql",
    controls: true,
    overTotal: false,
    ready: [],
    patch: () => {},
    draft,
    minFillMs: 0,
    openedAt: Date.now(),
    honeypot: "",
    signal: new AbortController().signal,
    setFailure: (failure) => calls.failure.push(failure),
    setSent: (value) => calls.sent.push(value),
    onSubmitted: (detail) => calls.submitted.push(detail),
    onError: (detail) => calls.errors.push(detail),
    ...over,
  };
  return { ctx, calls, draft };
}

describe("runSubmit", () => {
  test("without a project key it fails on config, calls onError and sends nothing", async () => {
    const { ctx, calls } = context({ projectKey: null });
    await runSubmit(values, ctx);
    expect(sent).toBe(0);
    expect(calls.errors).toEqual([{ code: "config" }]);
    expect(calls.failure.at(-1)?.code).toBe("config");
    expect(calls.submitted).toEqual([]);
  });

  test("a close before the report resolves emits nothing and keeps the draft", async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx, calls, draft } = context({
      signal: controller.signal,
      minFillMs: 5,
      openedAt: Date.now(),
    });
    await runSubmit(values, ctx);
    expect(sent).toBe(0);
    expect(calls.submitted).toEqual([]);
    expect(calls.sent).toEqual([]);
    expect(draft.current).toEqual(values);
  });

  test("a saved report clears the draft, shows the confirmation and emits one submit", async () => {
    const { ctx, calls, draft } = context();
    await runSubmit(values, ctx);
    expect(sent).toBe(1);
    expect(draft.current).toBeNull();
    expect(calls.sent).toEqual([{ tracking: true, uploads: [] }]);
    expect(calls.submitted).toEqual([{ reportId: "r1", files: [] }]);
    expect(calls.errors).toEqual([]);
  });

  test("an API failure is reported once and nothing is emitted as submitted", async () => {
    globalThis.fetch = mock(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const { ctx, calls, draft } = context();
    await runSubmit(values, ctx);
    expect(calls.submitted).toEqual([]);
    expect(calls.errors).toHaveLength(1);
    expect(draft.current).toEqual(values);
  });
});
