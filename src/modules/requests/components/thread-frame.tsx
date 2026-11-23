import {
  Badge,
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { RequestDetail } from "../api";
import type { RequestsMessages } from "../model/messages";
import { STATE_TONE } from "../model/state-tone";

/** The title, the state badge and the date of the request. */
export function ThreadHeader({
  text,
  detail,
  title,
  formatDate,
}: {
  text: RequestsMessages;
  detail: RequestDetail | null;
  title: string;
  formatDate: (iso: string) => string;
}) {
  const state = detail?.publicState;
  return (
    <DialogHeader>
      <DialogTitle className="max-sm:line-clamp-1 max-sm:text-lg">
        {detail?.title ?? title}
      </DialogTitle>
      <DialogDescription className="flex flex-wrap items-center gap-2">
        {state ? (
          <Badge variant="soft" tone={STATE_TONE[state]}>
            {text.states[state]}
          </Badge>
        ) : null}
        {detail ? formatDate(detail.createdAt) : null}
      </DialogDescription>
    </DialogHeader>
  );
}

/** Back, then resolve or reopen according to the request's state. */
export function ThreadFooter({
  text,
  detail,
  acting,
  onBack,
  onResolve,
  onReopen,
}: {
  text: RequestsMessages;
  detail: RequestDetail | null;
  acting: boolean;
  onBack: () => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const t = text.thread;
  const state = detail?.publicState;
  const declined = state === "declined";
  const resolved = state === "resolved";
  return (
    <DialogFooter>
      <Button type="button" variant="tonal" onClick={onBack}>
        {t.back}
      </Button>
      {detail && !declined && !resolved ? (
        <Button
          type="button"
          variant="tonal"
          loading={acting}
          onClick={onResolve}
        >
          {t.resolve}
        </Button>
      ) : null}
      {resolved && detail?.canReopen ? (
        <Button
          type="button"
          variant="tonal"
          loading={acting}
          onClick={onReopen}
        >
          {t.reopen}
        </Button>
      ) : null}
    </DialogFooter>
  );
}
