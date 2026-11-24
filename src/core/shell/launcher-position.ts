/** The edge tab's geometry and the saved position: pure helpers, so the component stays small. */

/** The tab is a 44 px square at every width. */
export const TAB_SIZE = 44;
/** The free gap kept above and below the tab. */
export const TOP_GAP = 16;
export const BOTTOM_GAP = 16;
/** One Alt+arrow press moves the tab by this fraction of its free height. */
export const KEY_STEP = 0.05;
/** A pointer that moved less than this many pixels is a click, not a drag. */
export const DRAG_THRESHOLD = 6;

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The top and bottom limits of the tab's `top`, in a viewport `height` pixels tall. */
export function span(height: number) {
  const min = TOP_GAP;
  return { min, max: Math.max(min, height - BOTTOM_GAP - TAB_SIZE) };
}

/** The tab's `top` for a fraction of the free height. */
export function topOf(ratio: number, height: number) {
  const { min, max } = span(height);
  return min + clamp01(ratio) * (max - min);
}

/** The fraction of the free height for a `top`, clamped to the free span. */
export function ratioOf(top: number, height: number) {
  const { min, max } = span(height);
  return max === min ? 0 : clamp01((top - min) / (max - min));
}

/** The saved position is per host origin (the widget runs in the host's page). */
export const storageKey = (origin: string) =>
  `pulsarix-widget:launcher:${origin}`;

/** The reporter's saved fraction, or null: storage may be missing, blocked or hold junk. */
export function readSaved(): number | null {
  try {
    const raw = localStorage.getItem(storageKey(location.origin));
    const value = raw === null ? Number.NaN : Number(JSON.parse(raw)?.offset);
    return Number.isFinite(value) ? clamp01(value) : null;
  } catch {
    return null;
  }
}

export function writeSaved(offset: number): void {
  try {
    localStorage.setItem(
      storageKey(location.origin),
      JSON.stringify({ offset }),
    );
  } catch {
    // Storage can be blocked: the position then lasts until the page closes.
  }
}
