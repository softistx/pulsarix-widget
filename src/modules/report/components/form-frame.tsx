import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { ReactNode } from "react";
import type { Messages } from "../../../core/messages";
import { FORM_ID } from "./form-sections";

/** The project name, the title, the intro and the identified reporter's tabs. */
export function FormHeader({
  messages,
  projectName,
  headerExtra,
}: {
  messages: Messages;
  projectName: string | null;
  headerExtra?: ReactNode;
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
      <DialogDescription>
        {projectName ? messages.introFor(projectName) : messages.intro}
      </DialogDescription>
      {headerExtra}
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
        {messages.close}
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
