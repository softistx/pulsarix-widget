/**
 * A shadow root's stylesheet ignores `@property` rules, and with them the
 * `initial-value` every Tailwind and material custom property relies on (a button's
 * horizontal padding, a ring's offset, an animation's duration). This copies each
 * initial value into the lowest cascade layer, on every element: a non-inheriting
 * property then starts from its initial value on each element, as `@property` says.
 */
export function propertyDefaults(css: string): string {
  const rules = css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g);
  const declarations: string[] = [];
  for (const [, name, body] of rules) {
    const initial = /initial-value:\s*([^;}]+)/.exec(body as string)?.[1];
    if (initial !== undefined) declarations.push(`${name}:${initial.trim()}`);
  }
  if (declarations.length === 0) return css;
  return `${css}@layer properties{:host,*,:before,:after,::backdrop{${declarations.join(";")}}}`;
}
