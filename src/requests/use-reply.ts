import { type RefObject, useState } from "react";
import type { Locale } from "../config";
import {
  ACCEPTED_TYPES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "../files/rules";
import { putFile } from "../files/upload";
import { replyToRequest, type resolveRequest } from "./api";
import { threadErrorText } from "./error-text";
import type { RequestsMessages } from "./messages";
import { failure } from "./use-thread";

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
  const [acting, setActing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const call = { apiBase, publicKey: projectKey, identity, locale };

  const send = async (body: string, attached: File[]) => {
    setProblem(null);
    setNote(null);
    const trimmed = body.trim();
    if (!trimmed) return setProblem(t.needText);
    const oversize =
      attached.some(
        (f) => f.size > MAX_FILE_BYTES || !ACCEPTED_TYPES.includes(f.type),
      ) || attached.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES;
    if (oversize) return setProblem(t.errors.files);
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
      const failed: string[] = [];
      await Promise.all(
        attached.map(async (file, index) => {
          const ticket = reply.files[index];
          const result = ticket
            ? await putFile({
                apiBase,
                slot: ticket.slot,
                ticket: ticket.ticket,
                file,
                onProgress: () => {},
                signal: aborted.current.signal,
              })
            : { ok: false as const };
          if (!result.ok) failed.push(file.name);
        }),
      );
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
