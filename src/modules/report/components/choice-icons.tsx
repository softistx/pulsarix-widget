import { Icon } from "@softistx/material/embed";
import type { CSSProperties, ReactNode } from "react";
import type { IconName } from "../../../core/icons";

/** The duotone sprite icons of the type and impact cards (names in core/icons.ts; the tone is a theme `--<tone>-text` token (readable on the card; embed.css ships no such utility classes) on the icon only, the selected card stays primary; the reduced sheet is built by scripts/icon-sprite.ts and served at /widget/v1/icons/). */
const glyph = (name: IconName, tone: string): ReactNode => (
  <Icon
    name={name}
    className="size-5"
    // Temporary, until @softistx/material#5680 (ChoiceCardGroup: per-option icon tone with 3:1
    // duotone contrast): the tone and a heavier secondary layer (default .4) are set here.
    style={
      {
        color: `var(--${tone}-text)`,
        "--fa-secondary-opacity": 0.75,
      } as CSSProperties
    }
    aria-hidden="true"
  />
);

export const CHOICE_ICONS: Record<string, ReactNode> = {
  bug: glyph("bug", "error"),
  question: glyph("question", "info"),
  suggestion: glyph("lightbulb", "tertiary"),
  blocking: glyph("ban", "error"),
  annoying: glyph("triangle-exclamation", "warning"),
  minor: glyph("info", "info"),
};
