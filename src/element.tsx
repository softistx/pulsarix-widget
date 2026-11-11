import { adoptStyles } from "@softistx/material/lib";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./app";
import { OBSERVED_ATTRIBUTES, readConfig, type WidgetConfig } from "./config";
import widgetCss from "./generated/widget-css";
import { MESSAGES } from "./messages";
import { themeCssFor } from "./theme";

export const TAG_NAME = "pulsarix-widget";

export type WidgetEvent = "pulsarix:ready" | "pulsarix:open" | "pulsarix:close";

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
    this.#emit("pulsarix:ready");
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

  #emit(name: WidgetEvent) {
    this.dispatchEvent(new CustomEvent(name, { detail: {}, composed: true }));
  }

  #render() {
    if (!this.#root || !this.#shadow) return;
    const config = this.config;
    if (this.#themeFor !== config.accentColor) {
      this.#releaseTheme?.();
      this.#releaseTheme = adoptStyles(
        this.#shadow,
        themeCssFor(config.accentColor),
      );
      this.#themeFor = config.accentColor;
    }
    const dark =
      config.theme === "dark" ||
      (config.theme === "auto" && !!this.#media?.matches);
    // The widget's own resolved scheme drives `color-scheme` (base.css); nothing is inherited.
    this.setAttribute("data-resolved-theme", dark ? "dark" : "light");
    this.#root.render(
      <App
        messages={MESSAGES[config.locale]}
        dark={dark}
        open={this.#open}
        launcher={this.getAttribute("launcher") !== "false"}
        position={config.position}
        onOpenChange={(next) => this.#setOpen(next)}
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
  launcher?: boolean;
  /** Where to append the element; `document.body` by default. */
  target?: Element;
}

export interface WidgetHandle {
  element: PulsarixWidgetElement;
  open(): void;
  close(): void;
  destroy(): void;
  on(name: WidgetEvent, callback: (event: CustomEvent) => void): () => void;
}

export function mount(options: MountOptions): WidgetHandle {
  defineWidget();
  const element = document.createElement(TAG_NAME) as PulsarixWidgetElement;
  element.setAttribute("project-key", options.projectKey);
  if (options.locale) element.setAttribute("locale", options.locale);
  if (options.theme) element.setAttribute("theme", options.theme);
  if (options.position) element.setAttribute("position", options.position);
  if (options.accentColor)
    element.setAttribute("accent-color", options.accentColor);
  if (options.launcher === false) element.setAttribute("launcher", "false");
  (options.target ?? document.body).append(element);
  return {
    element,
    open: () => element.open(),
    close: () => element.close(),
    destroy: () => element.remove(),
    on(name, callback) {
      const listener = (event: Event) => callback(event as CustomEvent);
      element.addEventListener(name, listener);
      return () => element.removeEventListener(name, listener);
    },
  };
}

defineWidget();
