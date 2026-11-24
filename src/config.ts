/** The widget's configuration (plan section 10): read from attributes, validated, defaulted. */

export type Locale = "en" | "fr";
export type ThemeMode = "light" | "dark" | "auto";
/** Every value gives the round FAB; the values are read so existing embeds keep working. */
export type LauncherMode = "auto" | "pill" | "icon";
/** The edge the launcher is docked to. */
export type LauncherSide = "right" | "left";
/**
 * Where the launcher starts: its edge and a vertical fraction of the free height (0 top, 1 bottom).
 * The reporter can move it along the edge; what they chose wins over this starting point.
 */
export interface LauncherPlacement {
  side: LauncherSide;
  offset: number;
}
export const DEFAULT_PLACEMENT: LauncherPlacement = {
  side: "right",
  offset: 0.5,
};

export interface WidgetConfig {
  projectKey: string | null;
  locale: Locale;
  theme: ThemeMode;
  /** Read for compatibility (`launcher="pill"`, `"icon"`): the launcher is always the round FAB; `launcher="false"` is read by the element. */
  launcherMode: LauncherMode;
  /** The launcher's starting edge and height (`launcher-side`, `launcher-offset`). */
  launcher: LauncherPlacement;
  /** A valid hex seed from the host, or null: the built-in lavande theme then applies. */
  accentColor: string | null;
  /**
   * The widget wears the host's `@softistx/material` theme when the host has one (`true`, the
   * default); `data-inherit-theme="false"` keeps the widget's own look.
   */
  inheritTheme: boolean;
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
  /**
   * The signed identity token the host's server made for its signed-in user, or null (no
   * "My requests", today's form only). `identify()` sets and clears it at run time.
   */
  identity: string | null;
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
  "launcher",
  "launcher-side",
  "launcher-offset",
  "accent-color",
  "inherit-theme",
  "api-base",
  "mask-text",
  "attachments",
  "privacy-url",
  "prefill-email",
  "prefill-title",
  "metadata",
  "identity",
] as const;

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** A launcher offset: a number from 0 to 1 (a fraction of the free height), else the default 0.5. */
export function offsetOf(value: string | number | null | undefined): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : DEFAULT_PLACEMENT.offset;
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

/**
 * An identity token (`<payload>.<signature>`, both base64url) or null. Anything else is dropped,
 * so a stray character can never break a request header.
 */
export function identityOf(value: string | null): string | null {
  const token = value?.trim() ?? "";
  return token.length <= 4_096 && /^[\w-]+\.[\w-]+$/.test(token) ? token : null;
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
    launcherMode: oneOf(get("launcher"), ["auto", "pill", "icon"], "auto"),
    launcher: {
      side: oneOf(get("launcher-side"), ["right", "left"], "right"),
      offset: offsetOf(get("launcher-offset")),
    },
    accentColor: isHexColor(accent) ? accent.trim() : null,
    inheritTheme: get("inherit-theme") !== "false",
    apiBase: apiBaseOf(get("api-base")),
    maskText: get("mask-text") === "true",
    attachments: get("attachments") !== "false",
    privacyUrl: privacyUrlOf(get("privacy-url")),
    prefill: {
      email: (get("prefill-email") ?? "").trim().slice(0, 254),
      title: (get("prefill-title") ?? "").trim().slice(0, 200),
    },
    metadata: metadataOf(get("metadata")),
    identity: identityOf(get("identity")),
  };
}
