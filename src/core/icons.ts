/**
 * The one list of Font Awesome duotone icons the widget draws. `choice-icons.tsx` takes its names
 * from here and `scripts/icon-sprite.ts` cuts the reduced sprite (dist/icons/duotone.svg) from
 * exactly these. An icon used anywhere in the widget is added here first.
 */
export const ICON_NAMES = [
  "bug",
  "question",
  "lightbulb",
  "ban",
  "triangle-exclamation",
  "info",
  "list-ul",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
