/** The widget's configuration (plan section 10): read from attributes, validated, defaulted. */

export type Locale = "en" | "fr";
export type ThemeMode = "light" | "dark" | "auto";
export type Position = "bottom-right" | "bottom-left";

export interface WidgetConfig {
  projectKey: string | null;
  locale: Locale;
  theme: ThemeMode;
  position: Position;
  /** A valid hex seed from the host, or null: the built-in lavande theme then applies. */
  accentColor: string | null;
  /** Origin of the pulsarix host that serves `/public/graphql`; null until given. */
  apiBase: string | null;
  /** The "Mask the text on the page" option starts on (`data-mask-text="true"`). */
  maskText: boolean;
  /** The screenshot and file controls are shown (`data-attachments="false"` hides them). */
  attachments: boolean;
  /** An https or http link to the integrator's own privacy page, shown in the privacy line. */
  privacyUrl: string | null;
  /** Starting values of the form (`prefill-email`, `prefill-title`); empty when not given. */
  prefill: { email: string; title: string };
  /** Flat strings stored with the report (`metadata`, a JSON object), within the API's limits. */
  metadata: MetadataEntry[];
}

export interface MetadataEntry {
  key: string;
  value: string;
}

/** The API's limits on a report's metadata (`intake.submit.input`). */
export const METADATA_MAX_ENTRIES = 20;
export const METADATA_KEY_MAX = 64;
export const METADATA_VALUE_MAX = 512;
export const METADATA_MAX_BYTES = 2_048;

/** The attributes the element observes, in their HTML spelling. */
export const OBSERVED_ATTRIBUTES = [
  "project-key",
  "locale",
  "theme",
  "position",
  "accent-color",
  "api-base",
  "mask-text",
  "attachments",
  "privacy-url",
  "prefill-email",
  "prefill-title",
  "metadata",
] as const;

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** A hex colour (#rgb or #rrggbb): the only form accepted as a seed. */
export function isHexColor(value: string | null): value is string {
  return value !== null && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/** An http(s) URL's origin (plus path prefix), or null: anything else is not a base. */
export function apiBaseOf(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return (url.origin + url.pathname).replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** An http(s) link as written, or null: `javascript:` and the like are never linked. */
export function privacyUrlOf(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const encoder = new TextEncoder();
const stripControl = (text: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: that is the point
  text.replace(/[\u0000-\u001f\u007f]/g, "");

/**
 * A JSON object of strings (numbers and booleans are written as text) into the entries the API
 * accepts: at most 20, keys of 64 characters, values of 512, 2 KB in all. What does not fit is
 * left out, never thrown: a bad attribute must not break the widget.
 */
export function metadataOf(value: string | null): MetadataEntry[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return [];
  const entries: MetadataEntry[] = [];
  const seen = new Set<string>();
  let bytes = 0;
  for (const [rawKey, raw] of Object.entries(parsed)) {
    if (entries.length >= METADATA_MAX_ENTRIES) break;
    if (
      typeof raw !== "string" &&
      typeof raw !== "number" &&
      typeof raw !== "boolean"
    )
      continue;
    // Control characters are stripped, as the API does: a key left empty would refuse the report.
    const key = stripControl(rawKey).trim().slice(0, METADATA_KEY_MAX);
    const text = stripControl(String(raw)).slice(0, METADATA_VALUE_MAX);
    if (!key || seen.has(key)) continue;
    const size = encoder.encode(key).length + encoder.encode(text).length;
    if (bytes + size > METADATA_MAX_BYTES) continue;
    bytes += size;
    seen.add(key);
    entries.push({ key, value: text });
  }
  return entries;
}

/** An unknown or missing value falls back to its default; nothing throws on a bad attribute. */
export function readConfig(get: (name: string) => string | null): WidgetConfig {
  const accent = get("accent-color");
  return {
    projectKey: get("project-key"),
    locale: oneOf(get("locale"), ["en", "fr"], "en"),
    theme: oneOf(get("theme"), ["light", "dark", "auto"], "auto"),
    position: oneOf(
      get("position"),
      ["bottom-right", "bottom-left"],
      "bottom-right",
    ),
    accentColor: isHexColor(accent) ? accent.trim() : null,
    apiBase: apiBaseOf(get("api-base")),
    maskText: get("mask-text") === "true",
    attachments: get("attachments") !== "false",
    privacyUrl: privacyUrlOf(get("privacy-url")),
    prefill: {
      email: (get("prefill-email") ?? "").trim().slice(0, 254),
      title: (get("prefill-title") ?? "").trim().slice(0, 200),
    },
    metadata: metadataOf(get("metadata")),
  };
}
