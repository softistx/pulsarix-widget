import {
  Button,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@softistx/material/embed";
import type { Locale } from "../../../config";
import { REQUESTS_MESSAGES } from "../model/messages";
import { Privacy, type PrivacyProps } from "./privacy";

/** The reporter's preferences, behind the list's gear: e-mails about the replies, "Delete my data". */
export function Preferences({
  locale,
  onBack,
  ...privacy
}: PrivacyProps & { locale: Locale; onBack: () => void }) {
  const text = REQUESTS_MESSAGES[locale];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{text.prefs.title}</DialogTitle>
      </DialogHeader>
      <DialogBody role="region" aria-label={text.prefs.title}>
        <Privacy locale={locale} {...privacy} />
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="tonal" onClick={onBack}>
          {text.thread.back}
        </Button>
      </DialogFooter>
    </>
  );
}
