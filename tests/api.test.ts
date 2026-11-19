import { expect, test } from "bun:test";
import { IntakeError, submitReport } from "../src/api";
import { fetchMyRequests, fetchUnread } from "../src/requests/api";

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
  expect(result).toEqual({ reportId: "x", tracking: false, files: [] });
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

const refusal = (status: number, code: string, extra: object = {}) =>
  (async () =>
    new Response(
      JSON.stringify({ errors: [{ extensions: { code, ...extra } }] }),
      { status },
    )) as unknown as typeof fetch;

test("statuses map to kinds, and a rate limit keeps its retryAfter", async () => {
  const kinds: Array<[number, string]> = [
    [404, "rejected"],
    [403, "rejected"],
    [503, "unavailable"],
    [429, "rate-limited"],
    [400, "invalid"],
    [415, "invalid"],
    [413, "invalid"],
    [500, "unknown"],
  ];
  for (const [status, kind] of kinds) {
    const error = await submitReport({
      ...base,
      fetch: refusal(status, "intake.errors.x", { retryAfter: 90 }),
    }).catch((e) => e);
    expect(error.kind).toBe(kind);
    expect(error.retryAfterSeconds).toBe(90);
  }
});

test("a fetch that throws is a network failure", async () => {
  const error = await submitReport({
    ...base,
    fetch: (async () => {
      throw new TypeError("x");
    }) as unknown as typeof fetch,
  }).catch((e) => e);
  expect(error.kind).toBe("network");
});

test("the identity travels in its header, impact and type in the input", async () => {
  let init: RequestInit | undefined;
  let body: { variables: { input: Record<string, unknown> } } | undefined;
  await submitReport({
    ...base,
    identity: "a.b",
    input: { ...input, impact: "blocking", type: "bug" },
    fetch: (async (_url: string, i: RequestInit) => {
      init = i;
      body = JSON.parse(String(i.body));
      return new Response(
        JSON.stringify({
          data: { submitClientReport: { reportId: "x", tracking: true } },
        }),
      );
    }) as unknown as typeof fetch,
  });
  const sent = init as RequestInit;
  expect((sent.headers as Record<string, string>)["x-pulsarix-identity"]).toBe(
    "a.b",
  );
  expect(sent.credentials).toBe("omit");
  expect(body?.variables.input).toMatchObject({
    impact: "blocking",
    type: "bug",
  });
});

test("a 401 is an identity failure", async () => {
  const error = await submitReport({
    ...base,
    fetch: refusal(401, "intake.errors.identity-invalid"),
  }).catch((e) => e);
  expect(error.kind).toBe("identity");
});

test("fetchMyRequests sends the filter, page size and cursor; fetchUnread asks for one row", async () => {
  const bodies: Array<{ id: string; variables: Record<string, unknown> }> = [];
  const page = {
    nodes: [],
    counts: { open: 0, resolved: 0, declined: 0, all: 0 },
    unread: 4,
    emailsOn: false,
    endCursor: null,
    hasNextPage: false,
  };
  const fetch = (async (_url: string, i: RequestInit) => {
    bodies.push(JSON.parse(String(i.body)));
    return new Response(JSON.stringify({ data: { myRequests: page } }));
  }) as unknown as typeof globalThis.fetch;
  const opts = {
    apiBase: "https://p.test/",
    publicKey: "pk",
    identity: "a.b",
    locale: "en",
    fetch,
  };
  await fetchMyRequests({ ...opts, filter: "RESOLVED", after: "c1" });
  expect(bodies[0]?.id).toBe("myRequests");
  expect(bodies[0]?.variables).toEqual({
    publicKey: "pk",
    filter: "RESOLVED",
    first: 20,
    after: "c1",
  });
  expect(await fetchUnread(opts)).toBe(4);
  expect(bodies[1]?.variables.first).toBe(1);
});
