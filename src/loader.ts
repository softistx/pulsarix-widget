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
  inheritTheme?: boolean;
  apiBase?: string;
  launcher?: boolean | string;
  offset?: { bottom?: number | string; side?: number | string };
  maskText?: boolean;
  attachments?: boolean;
  privacyUrl?: string;
  prefill?: { email?: string; title?: string };
  metadata?: unknown;
  identity?: string;
}

interface Handle {
  open(): void;
  close(): void;
  setLauncherVisible(visible: boolean): void;
  identify(token: string | null): void;
  setTheme(theme: string): void;
  setLocale(locale: string): void;
  setMetadata(metadata: unknown): void;
  destroy(): void;
  on(name: string, cb: (e: CustomEvent) => void): () => void;
}

function parseJson(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const script = document.currentScript as HTMLScriptElement | null;
const base = script?.src ? new URL(".", script.src).href : "";

let handle: Handle | null = null;
let loading: Promise<void> | null = null;
// Bumped by `destroy`: a bundle that resolves after it must not mount.
let generation = 0;
const queue: Array<{ key?: string; run: (h: Handle) => void }> = [];
const listeners: Array<[string, (e: CustomEvent) => void]> = [];

/**
 * Runs `fn` now, or once the bundle has loaded. A keyed call (a setter) replaces the one still
 * queued under its key: only the last value of a setter matters. The others replay in order.
 */
function whenReady(fn: (h: Handle) => void, key?: string) {
  if (handle) return fn(handle);
  if (key) {
    const old = queue.findIndex((entry) => entry.key === key);
    if (old >= 0) queue.splice(old, 1);
  }
  queue.push({ key, run: fn });
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
      for (const entry of queue.splice(0)) entry.run(handle);
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
  setLauncherVisible: (visible: boolean) =>
    whenReady((h) => h.setLauncherVisible(visible)),
  identify: (token: string | null) => whenReady((h) => h.identify(token)),
  setTheme: (theme: string) => whenReady((h) => h.setTheme(theme), "theme"),
  setLocale: (locale: string) =>
    whenReady((h) => h.setLocale(locale), "locale"),
  setMetadata: (metadata: unknown) =>
    whenReady((h) => h.setMetadata(metadata), "metadata"),
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
    inheritTheme: data.inheritTheme === "false" ? false : undefined,
    apiBase: data.apiBase,
    launcher: data.launcher === "false" ? false : data.launcher,
    offset:
      data.offsetBottom || data.offsetSide
        ? { bottom: data.offsetBottom, side: data.offsetSide }
        : undefined,
    maskText: data.maskText === "true" ? true : undefined,
    attachments: data.attachments === "false" ? false : undefined,
    privacyUrl: data.privacyUrl,
    prefill:
      data.prefillEmail || data.prefillTitle
        ? { email: data.prefillEmail, title: data.prefillTitle }
        : undefined,
    metadata: parseJson(data.metadata),
    identity: data.identity,
  });
}
