import { lengthOf } from "./config";
import type { MountOptions } from "./element";

/** Writes the `mount()` options onto the element as the attributes `readConfig` reads. */
export function applyOptions(element: HTMLElement, options: MountOptions) {
  const put = (name: string, value: string | null | undefined | false) => {
    if (value) element.setAttribute(name, value);
  };
  put("project-key", options.projectKey);
  put("locale", options.locale);
  put("theme", options.theme);
  put("position", options.position);
  put("accent-color", options.accentColor);
  put("inherit-theme", options.inheritTheme === false && "false");
  put("api-base", options.apiBase);
  put("mask-text", options.maskText && "true");
  put("attachments", options.attachments === false && "false");
  put("privacy-url", options.privacyUrl);
  put("prefill-email", options.prefill?.email);
  put("prefill-title", options.prefill?.title);
  put("metadata", options.metadata && JSON.stringify(options.metadata));
  const { launcher } = options;
  put(
    "launcher",
    launcher === false
      ? "false"
      : typeof launcher === "string"
        ? launcher
        : null,
  );
  put("offset-bottom", lengthOf(options.offset?.bottom));
  put("offset-side", lengthOf(options.offset?.side));
}

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
