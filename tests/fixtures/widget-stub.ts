// Stands in for the hashed widget bundle in the loader spec.
const state = globalThis as unknown as {
  __stubGate: Promise<void>;
  __stubMounts: number;
};
await state.__stubGate;
export function mount() {
  state.__stubMounts++;
  return { open() {}, close() {}, destroy() {}, on: () => () => {} };
}
