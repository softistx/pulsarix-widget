import { Icon } from "@softistx/material/embed";
import type { ReactNode } from "react";
import type { IconName } from "../../../core/icons";

/** The duotone sprite icons of the type and impact cards (names in core/icons.ts; the tone is a theme token on the icon only, the selected card stays primary; the reduced sheet is built by scripts/icon-sprite.ts and served at /widget/v1/icons/). */
const glyph = (name: IconName, tone: string): ReactNode => (
  <Icon name={name} className={`size-5 ${tone}`} aria-hidden="true" />
);

export const CHOICE_ICONS: Record<string, ReactNode> = {
  bug: glyph("bug", "text-error"),
  question: glyph("question", "text-info"),
  suggestion: glyph("lightbulb", "text-tertiary"),
  blocking: glyph("ban", "text-error"),
  annoying: glyph("triangle-exclamation", "text-warning"),
  minor: glyph("info", "text-info"),
};
