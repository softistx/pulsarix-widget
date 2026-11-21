import { describe, expect, test } from "bun:test";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signPulsarixIdentity } from "./server";

const NOW = Date.UTC(2026, 0, 1);
const base = {
  secret: "test-identity-secret",
  publicKey: "pk_live_abc123",
  sub: "user_42",
  now: () => NOW,
};

// The verification of the API (pulsarix-api, intake/services/identity.service.ts
// `verifyIdentity`), reimplemented here from its contract: the repositories are separate, so the
// real function cannot be imported. The signature is the HMAC-SHA256 of the payload segment,
// keyed with the raw secret string; the claims are checked as the API's zod schema and its
// lifetime and skew rules do.
const MAX_LIFETIME_S = 24 * 60 * 60;
const SKEW_S = 5 * 60;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
function verify(token: string, secret: string, publicKey: string, at: number) {
  const [body, signature, ...rest] = token.split(".");
  if (
    token.length > 2048 ||
    rest.length > 0 ||
    !body ||
    !signature ||
    !BASE64URL.test(body) ||
    !BASE64URL.test(signature)
  )
    return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  const seconds = Math.floor(at / 1000);
  const ok =
    typeof c.sub === "string" &&
    c.sub.length >= 1 &&
    c.sub.length <= 200 &&
    (c.email === undefined ||
      (typeof c.email === "string" && c.email.length <= 254)) &&
    (c.name === undefined ||
      (typeof c.name === "string" && c.name.trim().length <= 100)) &&
    c.aud === publicKey &&
    Number.isInteger(c.iat) &&
    Number.isInteger(c.exp) &&
    c.exp > c.iat &&
    c.exp - c.iat <= MAX_LIFETIME_S &&
    c.iat <= seconds + SKEW_S &&
    c.exp >= seconds - SKEW_S;
  return ok ? c : null;
}

describe("signPulsarixIdentity", () => {
  test("signs the fixed test vector (computed apart with Python's hmac)", () => {
    expect(
      signPulsarixIdentity({
        ...base,
        email: "ada@example.com",
        name: "  Ada Lovelace ",
      }),
    ).toBe(
      "eyJzdWIiOiJ1c2VyXzQyIiwiZW1haWwiOiJhZGFAZXhhbXBsZS5jb20iLCJuYW1lIjoiQWRhIExvdmVsYWNlIiwiYXVkIjoicGtfbGl2ZV9hYmMxMjMiLCJpYXQiOjE3NjcyMjU2MDAsImV4cCI6MTc2NzIyOTIwMH0.lgjUGBgY4WMfVcp1wR7-e-KYXfw4ZF9F-L3W1xKxi6c",
    );
  });

  test("a token the verifier accepts, with the claims given", () => {
    const token = signPulsarixIdentity({ ...base, email: "ada@example.com" });
    expect(token).toMatch(/^[\w-]+\.[\w-]{43}$/);
    expect(verify(token, base.secret, base.publicKey, NOW)).toEqual({
      sub: "user_42",
      email: "ada@example.com",
      aud: "pk_live_abc123",
      iat: 1767225600,
      exp: 1767229200,
    });
  });

  test("the default life is one hour, a custom one and the 24 h maximum are kept", () => {
    const life = (ttlSeconds?: number) => {
      const t = signPulsarixIdentity({ ...base, ttlSeconds });
      const c = verify(t, base.secret, base.publicKey, NOW);
      return c.exp - c.iat;
    };
    expect(life()).toBe(3600);
    expect(life(90)).toBe(90);
    expect(life(86400)).toBe(86400);
  });

  test("a wrong secret or another key's audience is refused by the verifier", () => {
    const token = signPulsarixIdentity(base);
    expect(verify(token, "other-secret", base.publicKey, NOW)).toBeNull();
    expect(verify(token, base.secret, "pk_live_other", NOW)).toBeNull();
  });

  test("an expired token is refused past the skew, and now defaults to the clock", () => {
    const token = signPulsarixIdentity({ ...base, ttlSeconds: 60 });
    expect(
      verify(token, base.secret, base.publicKey, NOW + 6 * 60_000),
    ).toBeNull();
    const live = signPulsarixIdentity({ ...base, now: undefined });
    expect(
      verify(live, base.secret, base.publicKey, Date.now()),
    ).not.toBeNull();
  });

  test("the secret is the raw string, not base64url-decoded bytes", () => {
    const token = signPulsarixIdentity({ ...base, secret: "aGVsbG8" });
    const [body, signature] = token.split(".");
    expect(signature).toBe(
      createHmac("sha256", "aGVsbG8")
        .update(body as string)
        .digest("base64url"),
    );
    expect(signature).not.toBe(
      createHmac("sha256", Buffer.from("aGVsbG8", "base64url"))
        .update(body as string)
        .digest("base64url"),
    );
  });

  test("a blank name is left out and the name is trimmed", () => {
    const claims = (name: string) =>
      JSON.parse(
        Buffer.from(
          signPulsarixIdentity({ ...base, name }).split(".")[0] as string,
          "base64url",
        ).toString(),
      );
    expect(claims("   ")).not.toHaveProperty("name");
    expect(claims(" Ada ").name).toBe("Ada");
  });

  describe("refuses what the API would refuse", () => {
    test("an empty secret", () => {
      expect(() => signPulsarixIdentity({ ...base, secret: "" })).toThrow(
        /secret/,
      );
    });
    test("an empty public key", () => {
      expect(() => signPulsarixIdentity({ ...base, publicKey: "" })).toThrow(
        /publicKey/,
      );
    });
    test("an empty sub", () => {
      expect(() => signPulsarixIdentity({ ...base, sub: "" })).toThrow(/sub/);
    });
    test("a sub over 200 characters", () => {
      expect(() =>
        signPulsarixIdentity({ ...base, sub: "u".repeat(201) }),
      ).toThrow(/sub/);
      expect(() =>
        signPulsarixIdentity({ ...base, sub: "u".repeat(200) }),
      ).not.toThrow();
    });
    test("a ttl over 24 hours", () => {
      expect(() =>
        signPulsarixIdentity({ ...base, ttlSeconds: 86401 }),
      ).toThrow(/ttlSeconds/);
    });
    test.each([0, -5, 1.5, Number.NaN])("a ttl of %p", (ttlSeconds) => {
      expect(() => signPulsarixIdentity({ ...base, ttlSeconds })).toThrow(
        /ttlSeconds/,
      );
    });
    test("a bad email", () => {
      for (const email of [
        "",
        "ada",
        "ada@",
        "a b@example.com",
        "ada@example",
      ]) {
        expect(() => signPulsarixIdentity({ ...base, email })).toThrow(/email/);
      }
    });
    test("an email over 254 characters", () => {
      const email = `${"a".repeat(250)}@example.com`;
      expect(() => signPulsarixIdentity({ ...base, email })).toThrow(/email/);
    });
    test("a name over 100 characters", () => {
      expect(() =>
        signPulsarixIdentity({ ...base, name: "n".repeat(101) }),
      ).toThrow(/name/);
    });
    test("a token over 2048 characters", () => {
      expect(() =>
        signPulsarixIdentity({
          ...base,
          sub: "é".repeat(200),
          publicKey: "k".repeat(2000),
        }),
      ).toThrow(/2048/);
    });
    test("a clock that is not milliseconds", () => {
      expect(() =>
        signPulsarixIdentity({ ...base, now: () => Number.NaN }),
      ).toThrow(/now/);
    });
  });
});
