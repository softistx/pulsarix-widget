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
    }): Promise<void>;
    open(): void;
    close(): void;
    destroy(): void;
    on(name: string, cb: (e: CustomEvent) => void): () => void;
  };
}
