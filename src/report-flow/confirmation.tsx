import {
  Alert,
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { Ref } from "react";
import type { Messages } from "../messages";

export function Confirmation({
  messages,
  tracking,
  doneRef,
  onClose,
}: {
  messages: Messages;
  tracking: boolean;
  doneRef: Ref<HTMLDivElement>;
  onClose: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{messages.done.title}</DialogTitle>
        <DialogDescription>{messages.done.body}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div ref={doneRef} tabIndex={-1} role="status" className="outline-none">
          <Alert
            variant="success"
            description={
              tracking ? messages.done.tracking : messages.done.noTracking
            }
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>{messages.close}</Button>
      </DialogFooter>
    </>
  );
}
