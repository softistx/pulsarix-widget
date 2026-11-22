import { themeCssFor } from "./theme";

/**
 * Inheriting the host's theme. The widget's tokens are declared on its own root element inside
 * the shadow root (`[data-nxgt-theme]`), so they shadow whatever the page declares, and a
 * `--x: var(--x, fallback)` would be a cycle. The host's values are therefore read once from
 * `<html>`'s computed style, validated, and set as inline custom properties on that root element:
 * an inline declaration beats the theme rule, and a token the host lacks or gets wrong keeps the
 * widget's own value (the fallback).
 */

type Kind = "color" | "length" | "percent";

/** The token names (and what each holds) come from the built-in theme's own stylesheet. */
let tokens: ReadonlyMap<string, Kind> | null = null;

/**
 * The tokens the widget takes from its host: those the built-in theme declares as a literal value
 * (a colour, a length or a percentage). A token declared from another (`--ground`, `--destructive`)
 * is left to the widget's own rule, so it follows the inherited ones; fonts are never inherited.
 */
export function inheritableTokens(): ReadonlyMap<string, Kind> {
  if (tokens) return tokens;
  const block = themeCssFor(null).split(".dark")[0] ?? "";
  const found = new Map<string, Kind>();
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (!name || !value || name.startsWith("--font-") || value.includes("var("))
      continue;
    found.set(
      name,
      name === "--radius"
        ? "length"
        : value.trim().endsWith("%") && !value.includes("(")
          ? "percent"
          : "color",
    );
  }
  tokens = found;
  return found;
}

/** With an explicit `accentColor`, the host's primary family stays out: the accent wins. */
const PRIMARY = /^--(inverse-)?primary/;

/** A colour is a hex, a function (`oklch(...)`, `rgb(...)`, `color-mix(...)`) or one keyword. */
const COLOR_SHAPE = /^(?:#[0-9a-f]{3,8}|[a-z-]+\([^;{}"'\\]*\)|[a-z]+)$/i;

/** Keywords that would not be the host's colour but a lookup (`inherit`, `currentcolor`, ...), and `url(`. */
const NOT_A_COLOR =
  /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$|url\(/i;

export const isColor = (value: string) =>
  COLOR_SHAPE.test(value) &&
  !NOT_A_COLOR.test(value) &&
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("color", value);

function valid(kind: Kind, value: string, rootPx: number): string | null {
  if (kind === "color") return isColor(value) ? value : null;
  if (kind === "percent") return /^\d+(\.\d+)?%$/.test(value) ? value : null;
  // A length: px stays, rem is turned into px against the host's root size, so the widget (which
  // ships no rem) draws the radius the host does.
  const m = /^(\d*\.?\d+)(px|rem)$/.exec(value);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "rem" ? rootPx : 1);
  return Number.isFinite(n) ? `${Math.round(n * 100) / 100}px` : null;
}

export interface HostTheme {
  /** Custom properties to set on the widget's root; empty when the host gave nothing usable. */
  tokens: Record<string, string>;
  /** The host's scheme when it says so (a `dark`/`light` class, or `color-scheme`), else null. */
  dark: boolean | null;
}

export function readHostTheme(
  doc: Document,
  { accent }: { accent: boolean },
): HostTheme {
  const html = doc.documentElement;
  const view = doc.defaultView;
  const out: Record<string, string> = {};
  if (!view) return { tokens: out, dark: null };
  const style = view.getComputedStyle(html);
  const rootPx = Number.parseFloat(style.fontSize) || 16;
  for (const [name, kind] of inheritableTokens()) {
    if (accent && PRIMARY.test(name)) continue;
    const ok = valid(kind, style.getPropertyValue(name).trim(), rootPx);
    if (ok) out[name] = ok;
  }
  const hasTokens = Object.keys(out).length > 0;
  let dark: boolean | null = null;
  if (hasTokens) {
    const classes = html.classList;
    const scheme = style.getPropertyValue("color-scheme").trim();
    if (classes.contains("dark")) dark = true;
    else if (classes.contains("light")) dark = false;
    else if (scheme === "dark") dark = true;
    else if (scheme === "light") dark = false;
  }
  return { tokens: out, dark };
}

export function sameTokens(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
}

/** Attributes of `<html>` a theme switch usually touches. */
const WATCHED = [
  "class",
  "style",
  "data-theme",
  "data-mode",
  "data-nxgt-theme",
  "data-color-scheme",
];

/** Calls `onChange` when the host's `<html>` attributes or its colour scheme change. */
export function watchHostTheme(
  doc: Document,
  onChange: () => void,
): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: WATCHED,
  });
  const media = doc.defaultView?.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener("change", onChange);
  };
}

/**
 * Follows the host's theme for one widget: `sync()` starts or stops watching (per its options)
 * and re-reads the tokens; `onChange` runs only when what the widget wears changed.
 */
export function createHostFollower(
  doc: Document,
  options: () => { inherit: boolean; accent: boolean },
  onChange: () => void,
) {
  let current: HostTheme = { tokens: {}, dark: null };
  let stop: (() => void) | null = null;
  const read = () => {
    current = readHostTheme(doc, { accent: options().accent });
  };
  return {
    get current() {
      return current;
    },
    sync() {
      if (!options().inherit) {
        this.stop();
        return;
      }
      stop ??= watchHostTheme(doc, () => {
        const before = current;
        read();
        if (
          before.dark !== current.dark ||
          !sameTokens(before.tokens, current.tokens)
        )
          onChange();
      });
      read();
    },
    stop() {
      stop?.();
      stop = null;
      current = { tokens: {}, dark: null };
    },
  };
}
