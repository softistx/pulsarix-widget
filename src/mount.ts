import {
  type LauncherMode,
  type LauncherOffset,
  type Locale,
  lengthOf,
  type ThemeMode,
} from "./config";
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
  /** The floating button: `"auto"` (icon below 640 px, pill above), `"pill"`, `"icon"`, or `false`. */
  launcher?: boolean | LauncherMode;
  /** Launcher distance from the bottom and its side (16 px default): pixels, or a CSS length. */
  offset?: LauncherOffset;
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
  /** Shows or hides the launcher only; an open dialog is never closed or hidden by it. */
  setLauncherVisible(visible: boolean): void;
  /**
   * Hides the launcher until the returned function is called, for a host's own sticky bar.
   * Ref-counted: the launcher stays hidden while any hold is open, and shows again once every
   * hold is released and `setLauncherVisible` is not `false`. Releasing twice does nothing.
   */
  holdLauncher(): () => void;
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
  applyOptions(element, options);
  if (options.identity) element.identify(options.identity);
  (options.target ?? document.body).append(element);
  // The launcher shows only when the host did not hide it and no hold is open.
  let wanted = true;
  let holds = 0;
  const applyLauncher = () => element.setLauncherVisible(wanted && holds === 0);
  const handle: WidgetHandle = {
    element,
    open: () => element.open(),
    close: () => element.close(),
    setLauncherVisible(visible) {
      wanted = visible;
      applyLauncher();
    },
    holdLauncher() {
      let open = true;
      holds++;
      applyLauncher();
      return () => {
        if (!open) return;
        open = false;
        holds--;
        applyLauncher();
      };
    },
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
