/** Type-level checks: `publicCall` infers its variables and result from the `PersistedId`. */
import { expect, test } from "bun:test";
import { publicCall } from "./api";

const base = { apiBase: "https://api.test", locale: "en" };

/** Never called: `bun check` compiles it, so a wrong pairing fails the typecheck. */
async function pairings() {
  const count = await publicCall({
    ...base,
    id: "markRequestRead",
    variables: { publicKey: "pk", id: "1" },
  });
  const n: number = count.count;
  // @ts-expect-error the result is `{ count }`, not a boolean
  const wrong: boolean = count;

  await publicCall({
    ...base,
    id: "setRequestEmails",
    // @ts-expect-error `setRequestEmails` needs `on`, not `id`
    variables: { publicKey: "pk", id: "1" },
  });
  await publicCall({
    ...base,
    // @ts-expect-error not a persisted operation
    id: "nope",
    variables: {},
  });
  return [n, wrong];
}

test("publicCall pairs each persisted id with its variables and result", () => {
  expect(typeof pairings).toBe("function");
});
