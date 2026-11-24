import { adoptStyles, InlineIconSprites } from "@softistx/material/embed";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./app";
import {
  identityOf,
  type Locale,
  OBSERVED_ATTRIBUTES,
  readConfig,
  type ThemeMode,
  type WidgetConfig,
} from "./config";
import { MESSAGES } from "./core/messages";
import { createHostFollower } from "./core/theme/inherit";
import { themeCssFor, themeNameFor } from "./core/theme/theme";
import widgetCss from "./generated/widget-css";
import { applyOffset } from "./offset";

export const TAG_NAME = "pulsarix-widget";

const THEMES: readonly string[] = ["light", "dark", "auto"];
const LOCALES: readonly string[] = ["en", "fr"];

/** Flat strings stored with each report. */
export type MountMetadata = Record<string, string | number | boolean>;

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
  // `setTheme("light" | "dark")` was called: the widget's mode is that one, whatever the host says.
  #pinnedMode = false;
  #host = createHostFollower(
    document,
    () => ({
      inherit: this.config.inheritTheme,
      accent: this.config.accentColor !== null,
    }),
    () => this.#render(),
  );

  /**
   * The token given by `identify()` / `mount({ identity })`. It is kept here, not written as an
   * attribute, so it does not sit in the page's DOM; only a declarative `data-identity` does.
   */
  #identity: string | null = null;
  #launcherVisible = true;
  #offsetProps = new Set<string>();

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
    this.#host.sync();
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
    this.#host.stop();
    this.#root?.unmount();
    this.#root = null;
    this.#releaseTheme?.();
    this.#releaseBase?.();
    this.#releaseTheme = this.#releaseBase = null;
    this.#themeFor = null;
    this.#pinnedMode = false;
    this.#open = false;
  }

  attributeChangedCallback(name: string) {
    // A `theme` written as an attribute (mount, markup) is the host's own choice again: it no
    // longer pins the mode a previous `setTheme` set.
    if (name === "theme") this.#pinnedMode = false;
    if (!this.#root) return;
    this.#host.sync();
    this.#render();
  }

  /**
   * Signs the reporter in with the identity token the host's server signed, or out with `null`
   * (on the host's sign-out): the dialog then shows or drops New request and My requests.
   */
  identify(token: string | null) {
    this.#identity = token || null;
    if (!token) this.removeAttribute("identity"); // drops a declarative `data-identity` too
    this.#render();
  }

  /** Shows or hides the launcher only; an open dialog stays. */
  setLauncherVisible(visible: boolean) {
    this.#launcherVisible = visible;
    this.#render();
  }

  /**
   * Changes the widget's own light or dark mode at run time. No remount: an open dialog and its
   * draft stay as they are. `"auto"` follows the OS (`prefers-color-scheme`), never the host
   * page's own mode: pass `"light"` or `"dark"` to follow the host's. With `inheritTheme`, an
   * explicit `"light"` or `"dark"` wins over the host's mode, `"auto"` gives it back to the host.
   */
  setTheme(theme: ThemeMode) {
    if (!THEMES.includes(theme)) return;
    // An explicit mode beats the inherited host mode; `"auto"` hands the choice back to it.
    this.setAttribute("theme", theme);
    this.#pinnedMode = theme !== "auto";
    this.#render();
  }

  /** Changes the language of the strings at run time; the dialog and its draft stay. */
  setLocale(locale: Locale) {
    if (!LOCALES.includes(locale)) return;
    this.setAttribute("locale", locale);
  }

  /**
   * Replaces the metadata sent with the next report (the same limits as `mount()`); `null` or
   * `{}` clears it. A report already sent is not changed, and the draft stays.
   */
  setMetadata(metadata: MountMetadata | null) {
    if (
      metadata &&
      typeof metadata === "object" &&
      Object.keys(metadata).length
    )
      this.setAttribute("metadata", JSON.stringify(metadata));
    else this.removeAttribute("metadata");
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
    // With the host's tokens, the widget's scheme is the host's (they are its current mode's
    // values); the `theme` option then only decides when the host does not say.
    const dark = this.#pinnedMode
      ? config.theme === "dark"
      : (this.#host.current.dark ??
        (config.theme === "dark" ||
          (config.theme === "auto" && !!this.#media?.matches)));
    applyOffset(this, config.offset, this.#offsetProps);
    // The widget's own resolved scheme drives `color-scheme` (base.css); nothing is inherited.
    this.setAttribute("data-resolved-theme", dark ? "dark" : "light");
    const apiBase = config.apiBase?.replace(/\/+$/, "");
    this.#root.render(
      <InlineIconSprites
        base={
          apiBase
            ? `${apiBase}/assets/icons/sprites/`
            : "/assets/icons/sprites/"
        }
      >
        <App
          themeName={themeNameFor(config.accentColor)}
          hostTokens={this.#host.current.tokens}
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
        />
      </InlineIconSprites>,
    );
  }
}

export function defineWidget(): void {
  if (!customElements.get(TAG_NAME))
    customElements.define(TAG_NAME, PulsarixWidgetElement);
}

defineWidget();
