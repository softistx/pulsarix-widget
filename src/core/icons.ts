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
  // Not drawn here yet: the requests view (#180) uses it, and the sheet is cut from this one list.
  "list-ul",
  "camera",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ABSOLUTE_BASE =
  /^(?:https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*|http:\/\/localhost)(?::\d{1,5})?(?:\/[\w./~-]*)?$/i;

/**
 * Where InlineIconSprites fetches the widget's sheet: `<apiBase>/widget/v1/icons/`, or null.
 * material throws `IconRefError("base")` (and the widget would unmount) for a base that is not
 * root-relative or https (http only on localhost) with a path of `[\w./~-]`; the same rule is
 * applied here so that such a host gets blank icons instead. No `apiBase`: no fetch from the host
 * page's own origin.
 */
export function iconBase(apiBase: string | null | undefined): string | null {
  if (!apiBase) return null;
  const base = `${apiBase.replace(/\/+$/, "")}/widget/v1/icons/`;
  return base.length <= 256 && !base.includes("..") && ABSOLUTE_BASE.test(base)
    ? base
    : null;
}
