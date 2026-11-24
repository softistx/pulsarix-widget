import { InlineIconSprites } from "@softistx/material/embed";
import type { ReactNode } from "react";
import { iconBase } from "./icons";

/** The icon sheet provider, or none (blank icons) when there is no safe base: see `iconBase`. */
export function IconSheets({
  apiBase,
  children,
}: {
  apiBase: string | null;
  children: ReactNode;
}) {
  const base = iconBase(apiBase);
  return base ? (
    <InlineIconSprites base={base}>{children}</InlineIconSprites>
  ) : (
    children
  );
}
