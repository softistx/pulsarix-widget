import { defineTheme, themeToCss } from "@softistx/material-core/theme";

/** The scope attribute the generated tokens are declared under. */
export const THEME_NAME = "pulsarix";

const cache = new Map<string, string>();

/**
 * The material theme generated from the accent colour: the seed of the primary
 * colour, every other token solved from it (AA contrast checked, light and
 * dark). Pure and CSP-safe: the result is text, adopted as a constructable
 * stylesheet, never a style element. It scopes to `[data-nxgt-theme="pulsarix"]`,
 * which the widget's root element carries inside the shadow root.
 */
export function themeCssFor(accent: string): string {
  const hit = cache.get(accent);
  if (hit) return hit;
  const theme = defineTheme({
    name: THEME_NAME,
    label: "Pulsarix",
    colors: { primary: accent },
  });
  const { css } = themeToCss(theme, { header: false });
  cache.set(accent, css);
  return css;
}
