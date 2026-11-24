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
import type { Messages } from "../../../core/messages";
import type { UploadFailure } from "../../files/model/upload";

/** What became of one file: sent, or why not. */
export type UploadOutcome = {
  name: string;
  role: "screenshot" | "file";
  type: string;
  size: number;
} & ({ ok: true } | { ok: false; reason: UploadFailure });

export function Confirmation({
  messages,
  tracking,
  uploads,
  doneRef,
  onClose,
  onRequests,
}: {
  messages: Messages;
  tracking: boolean;
  uploads: UploadOutcome[];
  doneRef: Ref<HTMLDivElement>;
  onClose: () => void;
  onRequests?: () => void;
}) {
  const failed = uploads.flatMap((upload) => (upload.ok ? [] : [upload]));
  const sent = uploads.length - failed.length;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{messages.done.title}</DialogTitle>
        <DialogDescription>{messages.done.body}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div ref={doneRef} tabIndex={-1} role="status" className="outline-none">
          <Alert
            variant={tracking ? "success" : "info"}
            description={
              tracking ? messages.done.tracking : messages.done.noTracking
            }
          />
          {uploads.length > 0 && failed.length === 0 ? (
            <p className="mt-3 text-muted-foreground text-sm">
              {messages.done.attached(sent)}
            </p>
          ) : null}
          {failed.length > 0 ? (
            <Alert
              className="mt-3"
              variant="warning"
              title={messages.done.partialTitle}
              description={
                <>
                  <span className="block">
                    {messages.done.partial(failed.length, uploads.length)}
                  </span>
                  <ul className="mt-2 grid gap-1">
                    {failed.map((upload, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a static list; two files may share a name
                      <li key={`${index}-${upload.name}`}>
                        <span className="font-medium">{upload.name}</span>
                        {": "}
                        {messages.files.reasons[upload.reason]}
                      </li>
                    ))}
                  </ul>
                </>
              }
            />
          ) : null}
        </div>
      </DialogBody>
      <DialogFooter>
        {onRequests ? (
          <Button type="button" variant="tonal" onClick={onClose}>
            {messages.close}
          </Button>
        ) : null}
        <Button onClick={onRequests ?? onClose}>
          {onRequests ? messages.myRequests : messages.close}
        </Button>
      </DialogFooter>
    </>
  );
}
