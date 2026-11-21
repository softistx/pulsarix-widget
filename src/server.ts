/**
 * Server-side helper of `@softistx/pulsarix-widget/server`: signs the reporter identity token a
 * host app's server hands to its signed-in user's browser (`identify(token)`).
 *
 * Server only: it uses `node:crypto` (Node and Bun) and is built apart from the widget bundle
 * and the loader, which never import it.
 *
 * The token is `<payload>.<signature>`, both base64url without padding. The payload is the JSON
 * `{ sub, email?, name?, aud, iat, exp }`; the signature is the HMAC-SHA256 of the payload
 * segment (the text as sent), keyed with the identity secret taken as the raw string (its UTF-8
 * bytes, not base64url-decoded), as the pulsarix API checks it. Every refusal below is one the
 * API would answer with `intake.errors.identity-invalid`.
 */
import { createHmac } from "node:crypto";

/** The longest life a token may have: 24 hours. 1 hour is recommended. */
export const MAX_TTL_SECONDS = 24 * 60 * 60;
/** The default life of a token: 1 hour. */
export const DEFAULT_TTL_SECONDS = 60 * 60;
/** The longest token the API reads. */
export const MAX_TOKEN_LENGTH = 2_048;

// The e-mail shape the API's validator accepts.
const EMAIL =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export interface SignPulsarixIdentityOptions {
  /** The key's identity secret, shown once in pulsarix. Keep it on the server, in an env var. */
  secret: string;
  /** The widget key's public key (`pk_…`): the token's audience. */
  publicKey: string;
  /** The signed-in user's stable id in your app (1 to 200 characters). Never stored by pulsarix. */
  sub: string;
  /** The user's e-mail address (at most 254 characters), used for replies. */
  email?: string | undefined;
  /** The user's display name (at most 100 characters once trimmed). */
  name?: string | undefined;
  /** How long the token lives, in whole seconds, 1 to 86 400. Defaults to 3 600 (1 hour). */
  ttlSeconds?: number;
  /** The clock, in milliseconds since the epoch. Defaults to `Date.now`; tests pass their own. */
  now?: () => number;
}

/**
 * Signs the identity token of one signed-in user. Call it per request (or per session) and
 * re-sign before the token expires. Throws an `Error` naming the option when the input is one
 * the API would refuse.
 */
export function signPulsarixIdentity(
  options: SignPulsarixIdentityOptions,
): string {
  const {
    secret,
    publicKey,
    sub,
    email,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    now = Date.now,
  } = options;
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error(
      "signPulsarixIdentity: `secret` must be a non-empty string",
    );
  }
  if (typeof publicKey !== "string" || publicKey.length === 0) {
    throw new Error(
      "signPulsarixIdentity: `publicKey` must be the widget key's public key (pk_…)",
    );
  }
  if (typeof sub !== "string" || sub.length < 1 || sub.length > 200) {
    throw new Error("signPulsarixIdentity: `sub` must be 1 to 200 characters");
  }
  if (
    typeof ttlSeconds !== "number" ||
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 1 ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new Error(
      `signPulsarixIdentity: \`ttlSeconds\` must be a whole number from 1 to ${MAX_TTL_SECONDS} (24 hours)`,
    );
  }
  if (
    email !== undefined &&
    (typeof email !== "string" || email.length > 254 || !EMAIL.test(email))
  ) {
    throw new Error(
      "signPulsarixIdentity: `email` must be a valid address of at most 254 characters",
    );
  }
  const name = options.name?.trim();
  if (name !== undefined && name.length > 100) {
    throw new Error(
      "signPulsarixIdentity: `name` must be at most 100 characters",
    );
  }
  const iat = Math.floor(now() / 1000);
  if (!Number.isFinite(iat)) {
    throw new Error("signPulsarixIdentity: `now` must return milliseconds");
  }
  const claims = {
    sub,
    ...(email === undefined ? {} : { email }),
    ...(name ? { name } : {}),
    aud: publicKey,
    iat,
    exp: iat + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const token = `${body}.${signature}`;
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error(
      `signPulsarixIdentity: the token is ${token.length} characters, over the ${MAX_TOKEN_LENGTH} the API reads: shorten \`sub\`, \`email\` or \`name\``,
    );
  }
  return token;
}
