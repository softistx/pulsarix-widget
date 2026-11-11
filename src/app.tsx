import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PortalContainerProvider,
} from "@softistx/material/components";
import { useState } from "react";
import type { Position } from "./config";
import type { Messages } from "./messages";
import { THEME_NAME } from "./theme";

export interface AppProps {
  messages: Messages;
  dark: boolean;
  open: boolean;
  launcher: boolean;
  position: Position;
  onOpenChange: (open: boolean) => void;
}

/**
 * The widget's tree. Its root element carries the theme scope and the dark class,
 * and is also the portal container: a dialog rendered into the shadow root itself
 * would sit outside the scope and lose the tokens.
 */
export function App({
  messages,
  dark,
  open,
  launcher,
  position,
  onOpenChange,
}: AppProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setRoot}
      className={dark ? "pulsarix-root dark" : "pulsarix-root"}
      data-nxgt-theme={THEME_NAME}
    >
      {root ? (
        <PortalContainerProvider container={root}>
          {launcher ? (
            <div
              className={
                position === "bottom-left"
                  ? "fixed bottom-4 left-4 z-40"
                  : "fixed right-4 bottom-4 z-40"
              }
            >
              <Button onClick={() => onOpenChange(true)}>
                {messages.launcher}
              </Button>
            </div>
          ) : null}
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>{messages.title}</DialogTitle>
                <DialogDescription>{messages.intro}</DialogDescription>
              </DialogHeader>
              <DialogBody aria-label={messages.title} className="grid gap-3" />
              <DialogFooter>
                <Button variant="outlined" onClick={() => onOpenChange(false)}>
                  {messages.close}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PortalContainerProvider>
      ) : null}
    </div>
  );
}
