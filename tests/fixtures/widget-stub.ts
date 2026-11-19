// Stands in for the hashed widget bundle in the loader spec.
const state = globalThis as unknown as {
  __stubGate: Promise<void>;
  __stubMounts: number;
  __stubOpened?: string[];
};
await state.__stubGate;
export function mount() {
  state.__stubMounts++;
  return {
    open: () => state.__stubOpened?.push("open"),
    close: () => state.__stubOpened?.push("close"),
    identify: (token: string | null) =>
      state.__stubOpened?.push(`identify:${token}`),
    destroy() {},
    on: () => () => {},
  };
}
