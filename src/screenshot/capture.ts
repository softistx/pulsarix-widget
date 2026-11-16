import {
  CaptureScreenError,
  canCaptureScreen,
  captureScreen,
} from "@softistx/material/capture";

/** The longest side of the flattened export the widget keeps (plan W2b). */
export const MAX_EXPORT_SIDE = 2_560;

export type CaptureFailure =
  | "denied"
  | "unavailable"
  | "maskUnavailable"
  | "failed";

/**
 * Whether the browser can take a screenshot here: `getDisplayMedia` exists, the device is
 * not a phone, and no `display-capture` permissions policy (a framed widget, a host header)
 * blocks it. When it is false the pane offers the upload alone.
 */
export function captureAvailable(): boolean {
  if (!canCaptureScreen()) return false;
  const policy = (
    document as {
      permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
    }
  ).permissionsPolicy;
  return policy?.allowsFeature?.("display-capture") !== false;
}

/** The host element of the shadow root `node` lives in, or null outside a shadow root. */
export function hostOf(node: Node | null): HTMLElement | null {
  const root = node?.getRootNode();
  return root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
}

/**
 * Takes one screenshot of the page with the widget out of it: the host is hidden with
 * `visibility` (not unmounted, so the form keeps its state and focus can come back), the
 * frame is grabbed, and the host is restored whatever happens. The host is also excluded
 * from `maskText`, since its own text is not in the frame.
 */
export async function captureWithHostHidden(
  host: HTMLElement | null,
  maskText: boolean,
): Promise<Blob> {
  const previous = host
    ? {
        value: host.style.getPropertyValue("visibility"),
        priority: host.style.getPropertyPriority("visibility"),
      }
    : null;
  host?.style.setProperty("visibility", "hidden", "important");
  try {
    return await captureScreen({
      maskText,
      unmaskSelector: "[data-capture-unmask], pulsarix-widget",
      type: "image/png",
    });
  } finally {
    if (host && previous) {
      if (previous.value)
        host.style.setProperty("visibility", previous.value, previous.priority);
      else host.style.removeProperty("visibility");
    }
  }
}

/** Maps what `captureScreen` throws to the message key the pane shows. */
export function failureOf(error: unknown): CaptureFailure {
  if (error instanceof CaptureScreenError) {
    if (error.code === "denied") return "denied";
    if (error.code === "unsupported") return "unavailable";
    if (error.code === "mask-unavailable") return "maskUnavailable";
  }
  return "failed";
}
