import { type RefObject, useState } from "react";
import type { Locale } from "../../../config";
import type { resolveRequest } from "../api";
import { threadErrorText } from "../model/error-text";
import { failure } from "../model/failure";
import type { RequestsMessages } from "../model/messages";

/** The resolve or reopen action of one thread: `acting` while it runs, `problem` set on failure. */
export function useThreadAction({
  text,
  call,
  requestId,
  read,
  aborted,
  setProblem,
}: {
  text: RequestsMessages;
  call: {
    apiBase: string;
    publicKey: string;
    identity: string;
    locale: Locale;
  };
  requestId: string;
  read: () => Promise<void>;
  aborted: RefObject<AbortController>;
  setProblem: (problem: string | null) => void;
}) {
  const [acting, setActing] = useState(false);

  const change = async (action: typeof resolveRequest) => {
    setProblem(null);
    setActing(true);
    try {
      await action({ ...call, id: requestId, signal: aborted.current.signal });
      if (!aborted.current.signal.aborted) await read();
    } catch (error) {
      if (aborted.current.signal.aborted) return;
      const failed = failure(error);
      setProblem(threadErrorText(text, failed));
      if (failed.code.endsWith("reopen-expired")) await read();
    } finally {
      if (!aborted.current.signal.aborted) setActing(false);
    }
  };

  return { acting, change };
}
