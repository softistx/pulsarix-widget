import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { Messages } from "../../../core/messages";
import { FORM_ID } from "./fields";

/** The project name, the title and the intro. */
export function FormHeader({
  messages,
  projectName,
}: {
  messages: Messages;
  projectName: string | null;
}) {
  return (
    <DialogHeader>
      {projectName ? (
        <p
          data-testid="project-name"
          className="font-semibold text-primary-text text-xs uppercase tracking-wide"
        >
          {projectName}
        </p>
      ) : null}
      <DialogTitle>{messages.title}</DialogTitle>
      <DialogDescription className="max-sm:sr-only">
        {projectName ? messages.introFor(projectName) : messages.intro}
      </DialogDescription>
    </DialogHeader>
  );
}

export function FormFooter({
  messages,
  onClose,
  submitting,
  blocked,
}: {
  messages: Messages;
  onClose: () => void;
  submitting: boolean;
  blocked: boolean;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="tonal" onClick={onClose}>
        {messages.cancel}
      </Button>
      <Button
        type="submit"
        form={FORM_ID}
        loading={submitting}
        disabled={blocked}
      >
        {messages.submit}
      </Button>
    </DialogFooter>
  );
}
