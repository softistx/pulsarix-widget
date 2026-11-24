import type { ReactNode } from "react";

/** A 20 px outline glyph in the current colour (material's /embed ships no icon set). */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Temporary, until material exports its icons from /embed: small local glyphs meanwhile.
export const CHOICE_ICONS: Record<string, ReactNode> = {
  bug: (
    <Glyph>
      <path d="M8 8a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM12 8v12M4 12h4M16 12h4M5 6l3 2M19 6l-3 2M5 19l3-2M19 19l-3-2" />
    </Glyph>
  ),
  question: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
    </Glyph>
  ),
  suggestion: (
    <Glyph>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </Glyph>
  ),
  blocking: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </Glyph>
  ),
  annoying: (
    <Glyph>
      <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
    </Glyph>
  ),
  minor: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Glyph>
  ),
};
