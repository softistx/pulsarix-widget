import { Icon } from "@softistx/material/embed";
import type { ReactNode } from "react";
import type { IconName } from "../../../core/icons";

/** The duotone sprite icons of the type and impact cards (names in core/icons.ts; the reduced sheet is built by scripts/icon-sprite.ts and served at /widget/v1/icons/). */
const glyph = (name: IconName): ReactNode => (
  <Icon name={name} className="size-5" aria-hidden="true" />
);

export const CHOICE_ICONS: Record<string, ReactNode> = {
  bug: glyph("bug"),
  question: glyph("question"),
  suggestion: glyph("lightbulb"),
  blocking: glyph("ban"),
  annoying: glyph("triangle-exclamation"),
  minor: glyph("info"),
};
