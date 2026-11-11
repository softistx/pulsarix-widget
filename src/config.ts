/** The widget's configuration (plan section 10): read from attributes, validated, defaulted. */

export const DEFAULT_ACCENT = "#4f46e5";

export type Locale = "en" | "fr";
export type ThemeMode = "light" | "dark" | "auto";
export type Position = "bottom-right" | "bottom-left";

export interface WidgetConfig {
  projectKey: string | null;
  locale: Locale;
  theme: ThemeMode;
  position: Position;
  accentColor: string;
  /** Origin of the pulsarix host that serves `/public/graphql`; null until given. */
  apiBase: string | null;
}

/** The attributes the element observes, in their HTML spelling. */
export const OBSERVED_ATTRIBUTES = [
  "project-key",
  "locale",
  "theme",
  "position",
  "accent-color",
  "api-base",
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
    accentColor: isHexColor(accent) ? accent.trim() : DEFAULT_ACCENT,
    apiBase: apiBaseOf(get("api-base")),
  };
}
