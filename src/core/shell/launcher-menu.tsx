import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@softistx/material/embed";
import { type ReactNode, useRef } from "react";
import type { LauncherSide } from "../../config";
import type { Messages } from "../messages";

/**
 * The identified reporter's menu beside the tab: "Report a problem" and "My requests" (with its unread
 * badge). Escape and a click outside close it, and focus goes back to the tab (`trigger`).
 */
export function LauncherMenu({
  messages,
  side,
  label,
  unread,
  open,
  onOpenChange,
  trigger,
  onReport,
  onRequests,
}: {
  messages: Messages;
  side: LauncherSide;
  label: string;
  unread: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  onReport: () => void;
  onRequests: () => void;
}) {
  // A choice opens the dialog, which takes focus: the menu must not pull it back onto the tab.
  const chose = useRef(false);
  const choose = (action: () => void) => {
    chose.current = true;
    action();
  };
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={side === "right" ? "left" : "right"}
        align="start"
        sideOffset={10}
        collisionPadding={8}
        aria-label={label}
        onCloseAutoFocus={(event) => {
          if (chose.current) {
            chose.current = false;
            event.preventDefault();
          }
        }}
      >
        <DropdownMenuItem
          className="pulsarix-tab-item"
          onSelect={() => choose(onReport)}
        >
          <Icon
            name="triangle-exclamation"
            className="size-5"
            aria-hidden="true"
          />
          <span>{messages.title}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="pulsarix-tab-item"
          onSelect={() => choose(onRequests)}
        >
          <Icon name="list-ul" className="size-5" aria-hidden="true" />
          <span>{messages.myRequests}</span>
          {unread > 0 ? (
            <Badge variant="error" aria-hidden="true">
              {unread}
            </Badge>
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
