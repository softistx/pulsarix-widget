import { Button, ConfirmDialog, SwitchField } from "@softistx/material/embed";
import { useEffect, useRef, useState } from "react";
import { IntakeError } from "../api";
import type { Locale } from "../config";
import { eraseMyData, setRequestEmails } from "./api";
import { errorText } from "./error-text";
import { REQUESTS_MESSAGES } from "./messages";

export interface PrivacyProps {
  locale: Locale;
  apiBase: string | null;
  projectKey: string | null;
  identity: string;
  /** The e-mail choice as the API last said it. */
  emailsOn: boolean;
  /** "Delete my data" erased this many requests. */
  onErased: (requests: number) => void;
}

/**
 * The reporter's privacy choices under the list: whether replies are also sent by e-mail
 * (optimistic, put back on a failure) and "Delete my data" behind a confirmation.
 */
export function Privacy({
  locale,
  apiBase,
  projectKey,
  identity,
  emailsOn: known,
  onErased,
}: PrivacyProps) {
  const text = REQUESTS_MESSAGES[locale];
  const [emailsOn, setEmailsOn] = useState(known);
  const [emailsError, setEmailsError] = useState(false);
  const saving = useRef(false);
  const [savingEmails, setSavingEmails] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // A read that lands while a save is in flight must not undo the optimistic choice.
  useEffect(() => {
    if (!saving.current) setEmailsOn(known);
  }, [known]);

  const base =
    apiBase && projectKey
      ? { apiBase, publicKey: projectKey, identity, locale }
      : null;

  async function changeEmails(next: boolean) {
    if (!base) return;
    const before = emailsOn;
    saving.current = true;
    setSavingEmails(true);
    setEmailsError(false);
    setEmailsOn(next);
    try {
      await setRequestEmails({ ...base, on: next });
    } catch {
      setEmailsOn(before);
      setEmailsError(true);
    } finally {
      saving.current = false;
      setSavingEmails(false);
    }
  }

  /** Throws the words of the failure, which the confirm dialog shows and stays open on. */
  async function eraseAll() {
    if (!base) throw new Error(text.privacy.eraseFailed);
    let result: { requests: number };
    try {
      result = await eraseMyData(base);
    } catch (error) {
      throw new Error(
        error instanceof IntakeError && error.kind !== "unknown"
          ? errorText(text, error)
          : text.privacy.eraseFailed,
      );
    }
    onErased(result.requests);
  }

  return (
    <div className="grid min-w-0 gap-3 border-border border-t pt-4">
      <SwitchField
        variant="plain"
        label={text.privacy.emails}
        helperText={
          emailsError ? text.privacy.emailsFailed : text.privacy.emailsHint
        }
        error={emailsError}
        checked={emailsOn}
        disabled={savingEmails}
        onCheckedChange={(next) => void changeEmails(next === true)}
      />
      <Button
        type="button"
        variant="outlined"
        color="error"
        className="justify-self-start"
        onClick={() => setConfirming(true)}
      >
        {text.privacy.erase}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={text.privacy.eraseTitle}
        description={text.privacy.eraseBody}
        confirmLabel={text.privacy.eraseConfirm}
        cancelLabel={text.privacy.eraseCancel}
        variant="destructive"
        tone="danger"
        onConfirm={eraseAll}
      />
    </div>
  );
}
