import type { PublicState } from "../api";

/** The badge tone of each public state, for the list and the thread. */
export const STATE_TONE = {
  received: "neutral",
  inProgress: "info",
  resolved: "success",
  declined: "warning",
} as const satisfies Record<PublicState, string>;
