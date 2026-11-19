import { adoptStyles } from "@softistx/material/embed";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./app";
import { OBSERVED_ATTRIBUTES, readConfig, type WidgetConfig } from "./config";
import widgetCss from "./generated/widget-css";
import { MESSAGES } from "./messages";
import { themeCssFor, themeNameFor } from "./theme";

export const TAG_NAME = "pulsarix-widget";

export type WidgetEvent =
  | "pulsarix:ready"
  | "pulsarix:open"
  | "pulsarix:close"
  | "pulsarix:submit"
  | "pulsarix:reply"
  | "pulsarix:unread"
  | "pulsarix:error";

/**
 * `<pulsarix-widget>`: an open shadow root holding material's stylesheet, the
 * generated theme and the React tree. Nothing is added to the page's document:
 * no style element, no global, no portal in `document.body`.
 */
export class PulsarixWidgetElement extends HTMLElement {
  static observedAttributes = [...OBSERVED_ATTRIBUTES, "launcher"];

  #root: Root | null = null;
  #shadow: ShadowRoot | null = null;
  #open = false;
  #releaseBase: (() => void) | null = null;
  #releaseTheme: (() => void) | null = null;
  #themeFor: string | null = null;
  #media: MediaQueryList | null = null;
  #onScheme = () => this.#render();

  get config(): WidgetConfig {
    return readConfig((name) => this.getAttribute(name));
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
    if (token) this.setAttribute("identity", token);
    else this.removeAttribute("identity");
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
  launcher?: boolean;
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
  if (options.identity) element.setAttribute("identity", options.identity);
  if (options.launcher === false) element.setAttribute("launcher", "false");
  (options.target ?? document.body).append(element);
  const handle: WidgetHandle = {
    element,
    open: () => element.open(),
    close: () => element.close(),
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
