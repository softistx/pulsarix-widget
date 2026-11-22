import type { Locale, ThemeMode } from "./config";
import {
  defineWidget,
  type MountMetadata,
  type PulsarixWidgetElement,
  TAG_NAME,
  type WidgetEvent,
} from "./element";

export interface MountOptions {
  projectKey: string;
  locale?: "en" | "fr";
  theme?: "light" | "dark" | "auto";
  position?: "bottom-left" | "bottom-right";
  accentColor?: string;
  /**
   * Wear the host app's `@softistx/material` theme (colours, radius, light or dark) and follow
   * its changes; a token the host lacks keeps the widget's own. `true` by default; an explicit
   * `accentColor` still wins over the host's primary. `false` keeps the widget's own look.
   */
  inheritTheme?: boolean;
  /** Origin of the pulsarix host (`https://pulsarix.example.com`); the loader fills it in. */
  apiBase?: string;
  launcher?: boolean;
  /** The screenshot's "Mask the text on the page" option starts on. */
  maskText?: boolean;
  /** `false` hides the screenshot and file controls (`data-attachments="false"`). */
  attachments?: boolean;
  /** Starting values of the form; the reporter can change them. */
  prefill?: { email?: string; title?: string };
  /** Flat strings stored with each report (20 entries, 2 KB at most; the rest is dropped). */
  metadata?: MountMetadata;
  /** Link to your own privacy page, shown after the privacy line (http or https). */
  privacyUrl?: string;
  /**
   * The identity token your server signed for the signed-in user (`<payload>.<signature>`).
   * With it the widget shows New request and My requests; change it later with `identify()`.
   */
  identity?: string;
  /** Where to append the element; `document.body` by default. */
  target?: Element;
}

export interface WidgetHandle {
  element: PulsarixWidgetElement;
  open(): void;
  close(): void;
  /** Signs the reporter in with a signed identity token, or out with `null`. */
  identify(token: string | null): void;
  /** Light or dark now, without a remount; `"auto"` follows the OS, not the host page. */
  setTheme(theme: ThemeMode): void;
  /**
   * Switches the language. The widget's strings change at once; `@softistx/material`'s built-in labels
   * follow when the form is idle (typed fields, type, impact and tab kept, attachments dropped), never
   * during a send, on the confirmation or on the requests tab.
   */
  setLocale(locale: Locale): void;
  /** Replaces the metadata sent with the next report (`null` clears it). */
  setMetadata(metadata: MountMetadata | null): void;
  destroy(): void;
  on(name: WidgetEvent, callback: (event: CustomEvent) => void): () => void;
}

let current: WidgetHandle | null = null;

/**
 * Mounts the widget. One widget per page: while a mounted one is still attached, a second call
 * returns its handle (and warns) instead of adding another element.
 */
export function mount(options: MountOptions): WidgetHandle {
  if (current?.element.isConnected) {
    console.warn(
      "[pulsarix] the widget is already mounted; the second mount is ignored",
    );
    return current;
  }
  defineWidget();
  const element = document.createElement(TAG_NAME) as PulsarixWidgetElement;
  element.setAttribute("project-key", options.projectKey);
  if (options.locale) element.setAttribute("locale", options.locale);
  if (options.theme) element.setAttribute("theme", options.theme);
  if (options.position) element.setAttribute("position", options.position);
  if (options.accentColor)
    element.setAttribute("accent-color", options.accentColor);
  if (options.inheritTheme === false)
    element.setAttribute("inherit-theme", "false");
  if (options.apiBase) element.setAttribute("api-base", options.apiBase);
  if (options.maskText) element.setAttribute("mask-text", "true");
  if (options.attachments === false)
    element.setAttribute("attachments", "false");
  if (options.privacyUrl)
    element.setAttribute("privacy-url", options.privacyUrl);
  if (options.prefill?.email)
    element.setAttribute("prefill-email", options.prefill.email);
  if (options.prefill?.title)
    element.setAttribute("prefill-title", options.prefill.title);
  if (options.metadata)
    element.setAttribute("metadata", JSON.stringify(options.metadata));
  if (options.identity) element.identify(options.identity);
  if (options.launcher === false) element.setAttribute("launcher", "false");
  (options.target ?? document.body).append(element);
  const handle: WidgetHandle = {
    element,
    open: () => element.open(),
    close: () => element.close(),
    identify: (token) => element.identify(token),
    setTheme: (theme) => element.setTheme(theme),
    setLocale: (locale) => element.setLocale(locale),
    setMetadata: (metadata) => element.setMetadata(metadata),
    destroy: () => element.remove(),
    on(name, callback) {
      const listener = (event: Event) => callback(event as CustomEvent);
      element.addEventListener(name, listener);
      return () => element.removeEventListener(name, listener);
    },
  };
  current = handle;
  return handle;
}
