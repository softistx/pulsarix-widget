// Stands in for the hashed widget bundle in the loader spec.
const state = globalThis as unknown as {
  __stubGate: Promise<void>;
  __stubMounts: number;
  __stubOpened?: string[];
  __stubOptions?: unknown[];
};
await state.__stubGate;
export function mount(options?: unknown) {
  state.__stubMounts++;
  state.__stubOptions?.push(options);
  return {
    open: () => state.__stubOpened?.push("open"),
    close: () => state.__stubOpened?.push("close"),
    setLauncherVisible: (visible: boolean) =>
      state.__stubOpened?.push(`launcher:${visible}`),
    identify: (token: string | null) =>
      state.__stubOpened?.push(`identify:${token}`),
    setTheme: (theme: string) => state.__stubOpened?.push(`theme:${theme}`),
    setLocale: (locale: string) => state.__stubOpened?.push(`locale:${locale}`),
    setMetadata: (metadata: unknown) =>
      state.__stubOpened?.push(`metadata:${JSON.stringify(metadata)}`),
    destroy() {},
    on: () => () => {},
  };
}
