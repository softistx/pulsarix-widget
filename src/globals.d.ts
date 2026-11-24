/** The loader's only global (plan section 10): `window.PulsarixWidget`. */
interface Window {
  PulsarixWidget: {
    init(options: {
      projectKey: string;
      locale?: string;
      theme?: string;
      accentColor?: string;
      apiBase?: string;
      launcher?:
        | boolean
        | "auto"
        | "pill"
        | "icon"
        | { side?: "right" | "left"; offset?: number };
      maskText?: boolean;
      attachments?: boolean;
      privacyUrl?: string;
      prefill?: { email?: string; title?: string };
      metadata?: Record<string, string | number | boolean>;
      identity?: string;
    }): Promise<void>;
    open(): void;
    close(): void;
    setLauncherVisible(visible: boolean): void;
    holdLauncher(): () => void;
    identify(token: string | null): void;
    setTheme(theme: "light" | "dark" | "auto"): void;
    setLocale(locale: "en" | "fr"): void;
    setMetadata(
      metadata: Record<string, string | number | boolean> | null,
    ): void;
    destroy(): void;
    on(name: string, cb: (e: CustomEvent) => void): () => void;
  };
}
