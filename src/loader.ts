/**
 * The loader: a few hundred bytes of classic script. It defines `window.PulsarixWidget`
 * (the only global), queues calls, and imports the hashed ESM bundle from the same
 * directory on the first `init`. The bundle's file name is injected at build time;
 * the loader itself is served with a short cache so a new release is picked up.
 */
declare const __WIDGET_FILE__: string;

interface InitOptions {
  projectKey: string;
  locale?: string;
  theme?: string;
  position?: string;
  accentColor?: string;
  apiBase?: string;
  launcher?: boolean;
}

interface Handle {
  open(): void;
  close(): void;
  destroy(): void;
  on(name: string, cb: (e: CustomEvent) => void): () => void;
}

const script = document.currentScript as HTMLScriptElement | null;
const base = script?.src ? new URL(".", script.src).href : "";

let handle: Handle | null = null;
let loading: Promise<void> | null = null;
// Bumped by `destroy`: a bundle that resolves after it must not mount.
let generation = 0;
const queue: Array<(h: Handle) => void> = [];
const listeners: Array<[string, (e: CustomEvent) => void]> = [];

function whenReady(fn: (h: Handle) => void) {
  if (handle) fn(handle);
  else queue.push(fn);
}

function init(given: InitOptions): Promise<void> {
  if (loading) return loading;
  // The API is the host that served this loader, unless the integrator says otherwise.
  const options = {
    ...given,
    apiBase: given.apiBase ?? (base ? new URL(base).origin : undefined),
  };
  const mine = generation;
  loading = import(/* @vite-ignore */ base + __WIDGET_FILE__)
    .then((mod: { mount: (o: InitOptions) => Handle }) => {
      if (mine !== generation) return;
      handle = mod.mount(options);
      for (const [name, cb] of listeners) handle.on(name, cb);
      for (const fn of queue.splice(0)) fn(handle);
    })
    .catch((error: unknown) => {
      if (mine === generation) loading = null;
      console.warn("[pulsarix] the widget could not be loaded", error);
    });
  return loading;
}

window.PulsarixWidget = {
  init,
  open: () => whenReady((h) => h.open()),
  close: () => whenReady((h) => h.close()),
  destroy: () => {
    generation++;
    handle?.destroy();
    handle = null;
    loading = null;
    listeners.length = 0;
    queue.length = 0;
  },
  on(name, cb) {
    const entry: [string, (e: CustomEvent) => void] = [name, cb];
    listeners.push(entry);
    const off = handle?.on(name, cb);
    return () => {
      const i = listeners.indexOf(entry);
      if (i >= 0) listeners.splice(i, 1);
      off?.();
    };
  },
};

const data = script?.dataset;
if (data?.projectKey) {
  void init({
    projectKey: data.projectKey,
    locale: data.locale,
    theme: data.theme,
    position: data.position,
    accentColor: data.accentColor,
    apiBase: data.apiBase,
    launcher: data.launcher === "false" ? false : undefined,
  });
}
