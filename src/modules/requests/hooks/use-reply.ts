import { type RefObject, useState } from "react";
import type { Locale } from "../../../config";
import { replyToRequest } from "../api";
import { threadErrorText } from "../model/error-text";
import { failure } from "../model/failure";
import type { RequestsMessages } from "../model/messages";
import { filesOversize, uploadFiles } from "../model/reply-files";
import { useThreadAction } from "./use-thread-action";

export interface UseReplyOptions {
  text: RequestsMessages;
  locale: Locale;
  apiBase: string;
  projectKey: string;
  identity: string;
  requestId: string;
  read: () => Promise<void>;
  aborted: RefObject<AbortController>;
}

/** The composer's state, the reply upload, and the resolve or reopen action of one thread. */
export function useReply({
  text,
  locale,
  apiBase,
  projectKey,
  identity,
  requestId,
  read,
  aborted,
}: UseReplyOptions) {
  const t = text.thread;
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const call = { apiBase, publicKey: projectKey, identity, locale };

  const send = async (body: string, attached: File[]) => {
    setProblem(null);
    setNote(null);
    const trimmed = body.trim();
    if (!trimmed) return setProblem(t.needText);
    if (filesOversize(attached)) return setProblem(t.errors.files);
    setSending(true);
    try {
      const reply = await replyToRequest({
        ...call,
        id: requestId,
        body: trimmed,
        files: attached.map((file) => ({
          role: "file" as const,
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        signal: aborted.current.signal,
      });
      const failed = await uploadFiles({
        apiBase,
        files: attached,
        tickets: reply.files,
        signal: aborted.current.signal,
      });
      if (aborted.current.signal.aborted) return;
      setValue("");
      setFiles([]);
      if (failed.length) setNote(t.filesFailed(failed.join(", ")));
      await read();
    } catch (error) {
      if (aborted.current.signal.aborted) return;
      setProblem(threadErrorText(text, failure(error)));
    } finally {
      if (!aborted.current.signal.aborted) setSending(false);
    }
  };

  const { acting, change } = useThreadAction({
    text,
    call,
    requestId,
    read,
    aborted,
    setProblem,
  });

  return {
    value,
    setValue,
    files,
    setFiles,
    sending,
    note,
    acting,
    problem,
    send,
    change,
  };
}
