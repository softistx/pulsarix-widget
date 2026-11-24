import { Icon } from "@softistx/material/embed";
import type { ReactNode } from "react";

/** The duotone sprite icons of the type and impact cards (the sheet is served by the host, see element.tsx). */
const glyph = (name: Parameters<typeof Icon>[0]["name"]): ReactNode => (
  <Icon name={name} className="size-5" aria-hidden="true" />
);

export const CHOICE_ICONS: Record<string, ReactNode> = {
  bug: glyph("bug"),
  question: glyph("circle-question"),
  suggestion: glyph("lightbulb"),
  blocking: glyph("circle-exclamation"),
  annoying: glyph("triangle-exclamation"),
  minor: glyph("circle-info"),
};
