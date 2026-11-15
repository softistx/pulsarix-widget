import { defineTheme, themeToCss } from "@softistx/material-core/theme";
import { lavande } from "@softistx/material-core/theme/presets";

/** The scope attribute of a theme seeded from the host's accent colour. */
export const ACCENT_THEME_NAME = "pulsarix";

const cache = new Map<string, string>();

/** The `data-nxgt-theme` value the widget's root carries for this accent (null: the default). */
export function themeNameFor(accent: string | null): string {
  return accent ? ACCENT_THEME_NAME : lavande.name;
}

/**
 * The theme stylesheet text. Without an accent it is material's built-in
 * `lavande` theme, the very tokens of the preset (no look-alike seed). With a
 * valid hex accent it is a theme seeded from it: the primary seed, every other
 * token solved (AA contrast checked, light and dark). Pure and CSP-safe: the
 * result is text, adopted as a constructable stylesheet, never a style element.
 * It scopes to `[data-nxgt-theme="<name>"]`, which the widget's root element
 * carries inside the shadow root.
 */
export function themeCssFor(accent: string | null): string {
  const key = accent ?? "";
  const hit = cache.get(key);
  if (hit) return hit;
  const theme = accent
    ? defineTheme({
        name: ACCENT_THEME_NAME,
        label: "Pulsarix",
        colors: { primary: accent },
      })
    : lavande;
  const { css } = themeToCss(theme, { header: false });
  cache.set(key, css);
  return css;
}
