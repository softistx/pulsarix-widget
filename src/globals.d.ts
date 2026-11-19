/** The loader's only global (plan section 10): `window.PulsarixWidget`. */
interface Window {
  PulsarixWidget: {
    init(options: {
      projectKey: string;
      locale?: string;
      theme?: string;
      position?: string;
      accentColor?: string;
      apiBase?: string;
      launcher?: boolean;
      maskText?: boolean;
      attachments?: boolean;
      privacyUrl?: string;
      prefill?: { email?: string; title?: string };
      metadata?: Record<string, string | number | boolean>;
      identity?: string;
    }): Promise<void>;
    open(): void;
    close(): void;
    identify(token: string | null): void;
    destroy(): void;
    on(name: string, cb: (e: CustomEvent) => void): () => void;
  };
}
