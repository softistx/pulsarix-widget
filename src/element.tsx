import { adoptStyles } from "@softistx/material/embed";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./app";
import {
  identityOf,
  type LauncherMode,
  type LauncherOffset,
  lengthOf,
  OBSERVED_ATTRIBUTES,
  readConfig,
  type WidgetConfig,
} from "./config";
import { MESSAGES } from "./core/messages";
import { themeCssFor, themeNameFor } from "./core/theme/theme";
import widgetCss from "./generated/widget-css";

export const TAG_NAME = "pulsarix-widget";

export type WidgetEvent =
  | "pulsarix:ready"
  | "pulsarix:open"
  | "pulsarix:close"
  | "pulsarix:submit"
  | "pulsarix:reply"
  | "pulsarix:unread"
  | "pulsarix:erase"
  | "pulsarix:error";

/**
 * `<pulsarix-widget>`: an open shadow root holding material's stylesheet, the
 * generated theme and the React tree. Nothing is added to the page's document:
 * no style element, no global, no portal in `document.body`.
 */
export class PulsarixWidgetElement extends HTMLElement {
  static observedAttributes = [...OBSERVED_ATTRIBUTES];

  #root: Root | null = null;
  #shadow: ShadowRoot | null = null;
  #open = false;
  #releaseBase: (() => void) | null = null;
  #releaseTheme: (() => void) | null = null;
  #themeFor: string | null = null;
  #media: MediaQueryList | null = null;
  #onScheme = () => this.#render();

  /**
   * The token given by `identify()` / `mount({ identity })`. It is kept here, not written as an
   * attribute, so it does not sit in the page's DOM; only a declarative `data-identity` does.
   */
  #identity: string | null = null;
  #launcherVisible = true;

  get config(): WidgetConfig {
    const config = readConfig((name) => this.getAttribute(name));
    return this.#identity
      ? { ...config, identity: identityOf(this.#identity) ?? config.identity }
      : config;
  }

  get isOpen(): boolean {
    return this.#open;
  }

  connectedCallback() {
    if (this.#root) return;
    this.#shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    this.#releaseBase = adoptStyles(this.#shadow, widgetCss);
    this.#root = createRoot(this.#shadow);
    this.#media = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
    this.#media?.addEventListener("change", this.#onScheme);
    this.#render();
    // Async: a listener added right after `mount()` returns still hears it.
    queueMicrotask(() => {
      this.#emit("pulsarix:ready");
      if (!this.config.projectKey)
        this.#emit("pulsarix:error", { code: "config" });
    });
  }

  disconnectedCallback() {
    this.#media?.removeEventListener("change", this.#onScheme);
    this.#media = null;
    this.#root?.unmount();
    this.#root = null;
    this.#releaseTheme?.();
    this.#releaseBase?.();
    this.#releaseTheme = this.#releaseBase = null;
    this.#themeFor = null;
    this.#open = false;
  }

  attributeChangedCallback() {
    if (this.#root) this.#render();
  }

  /**
   * Signs the reporter in with the identity token the host's server signed, or out with `null`
   * (on the host's sign-out): the dialog then shows or drops New request and My requests.
   */
  identify(token: string | null) {
    this.#identity = token || null;
    // Signing out drops a declarative `data-identity` too.
    if (!token) this.removeAttribute("identity");
    this.#render();
  }

  /** Shows or hides the launcher only: an open dialog stays, and `open()` still works. */
  setLauncherVisible(visible: boolean) {
    this.#launcherVisible = visible;
    this.#render();
  }

  open() {
    this.#setOpen(true);
  }

  close() {
    this.#setOpen(false);
  }

  #setOpen(next: boolean) {
    if (this.#open === next) return;
    this.#open = next;
    this.#render();
    this.#emit(next ? "pulsarix:open" : "pulsarix:close");
  }

  #emit(name: WidgetEvent, detail: object = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail, composed: true }));
  }

  #render() {
    if (!this.#root || !this.#shadow) return;
    const config = this.config;
    const themeKey = config.accentColor ?? "";
    if (this.#themeFor !== themeKey) {
      this.#releaseTheme?.();
      this.#releaseTheme = adoptStyles(
        this.#shadow,
        themeCssFor(config.accentColor),
      );
      this.#themeFor = themeKey;
    }
    const dark =
      config.theme === "dark" ||
      (config.theme === "auto" && !!this.#media?.matches);
    // The launcher's offsets are custom properties on the host: a host's own CSS may set them too.
    // Only a given option is written, so the host's rule or the default (16 px) stays otherwise.
    for (const [name, value] of [
      ["--pulsarix-launcher-bottom", config.offset.bottom],
      ["--pulsarix-launcher-side", config.offset.side],
    ] as const) {
      if (value) this.style.setProperty(name, value);
      else this.style.removeProperty(name);
    }
    // The widget's own resolved scheme drives `color-scheme` (base.css); nothing is inherited.
    this.setAttribute("data-resolved-theme", dark ? "dark" : "light");
    this.#root.render(
      <App
        themeName={themeNameFor(config.accentColor)}
        messages={MESSAGES[config.locale]}
        locale={config.locale}
        projectKey={config.projectKey}
        apiBase={config.apiBase}
        dark={dark}
        open={this.#open}
        launcher={this.getAttribute("launcher") !== "false"}
        launcherMode={config.launcherMode}
        launcherVisible={this.#launcherVisible}
        maskText={config.maskText}
        attachments={config.attachments}
        prefill={config.prefill}
        metadata={config.metadata}
        privacyUrl={config.privacyUrl}
        identity={config.identity}
        position={config.position}
        onOpenChange={(next) => this.#setOpen(next)}
        onSubmitted={(detail) => this.#emit("pulsarix:submit", detail)}
        onReply={(detail) => this.#emit("pulsarix:reply", detail)}
        onUnreadChange={(detail) => this.#emit("pulsarix:unread", detail)}
        onErase={(detail) => this.#emit("pulsarix:erase", detail)}
        onError={(detail) => this.#emit("pulsarix:error", detail)}
      />,
    );
  }
}

export function defineWidget(): void {
  if (!customElements.get(TAG_NAME))
    customElements.define(TAG_NAME, PulsarixWidgetElement);
}

export interface MountOptions {
  projectKey: string;
  locale?: "en" | "fr";
  theme?: "light" | "dark" | "auto";
  position?: "bottom-left" | "bottom-right";
  accentColor?: string;
  /** Origin of the pulsarix host (`https://pulsarix.example.com`); the loader fills it in. */
  apiBase?: string;
  /**
   * The floating button: `"auto"` (default; the icon below 640 px of viewport width, the text
   * pill above, live), `"pill"`, `"icon"` (a 48 px round button), or `false` for none.
   */
  launcher?: boolean | LauncherMode;
  /**
   * Distance of the launcher from the bottom and from its side (default 16 px each, plus the
   * bottom safe area). A number is pixels, a string any CSS length. Sets
   * `--pulsarix-launcher-bottom` and `--pulsarix-launcher-side` on the element.
   */
  offset?: LauncherOffset;
  /** The screenshot's "Mask the text on the page" option starts on. */
  maskText?: boolean;
  /** `false` hides the screenshot and file controls (`data-attachments="false"`). */
  attachments?: boolean;
  /** Starting values of the form; the reporter can change them. */
  prefill?: { email?: string; title?: string };
  /** Flat strings stored with each report (20 entries, 2 KB at most; the rest is dropped). */
  metadata?: Record<string, string | number | boolean>;
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
  /** Signs the reporter in with a signed identity token, or out with `null`. */
  identify(token: string | null): void;
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
  else if (typeof options.launcher === "string")
    element.setAttribute("launcher", options.launcher);
  const bottom = lengthOf(options.offset?.bottom);
  const side = lengthOf(options.offset?.side);
  if (bottom) element.setAttribute("offset-bottom", bottom);
  if (side) element.setAttribute("offset-side", side);
  (options.target ?? document.body).append(element);
  const handle: WidgetHandle = {
    element,
    open: () => element.open(),
    close: () => element.close(),
    setLauncherVisible: (visible) => element.setLauncherVisible(visible),
    identify: (token) => element.identify(token),
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

defineWidget();
