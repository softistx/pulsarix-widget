/** The launcher offset as custom properties on the widget element. */

const OFFSET_PROPERTIES = {
  bottom: "--pulsarix-launcher-bottom",
  side: "--pulsarix-launcher-side",
} as const;

/**
 * Mirrors the launcher offset onto the element as custom properties. Only a given option is
 * written, and only a property this element wrote is ever removed (`written` tracks them), so a
 * host stylesheet's own value or the 16 px default stays otherwise.
 */
export function applyOffset(
  element: HTMLElement,
  offset: { bottom: string | null; side: string | null },
  written: Set<string>,
) {
  for (const key of ["bottom", "side"] as const) {
    const name = OFFSET_PROPERTIES[key];
    const value = offset[key];
    if (value) {
      element.style.setProperty(name, value);
      written.add(name);
    } else if (written.delete(name)) {
      element.style.removeProperty(name);
    }
  }
}
