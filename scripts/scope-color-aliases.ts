/**
 * Tailwind declares `--color-card: var(--card)` on `:root, :host`, where `var()` resolves
 * once: the widget's dark class sits on an inner element, so `bg-[color-mix(... var(--color-card))]`
 * (the Alert's tint) stayed light in dark. Declaring the same aliases on the widget's root
 * resolves them against the root's own tokens.
 * Temporary, until nxgt-material#4311.
 */
export function scopeColorAliases(css: string): string {
  const aliases = new Set<string>();
  for (const [decl] of css.matchAll(/--color-[a-z0-9-]+:var\(--[a-z0-9-]+\)/g))
    aliases.add(decl);
  return `${css}.pulsarix-root{${[...aliases].join(";")}}`;
}
