import {
  Badge,
  ChatMarkdown,
  ChatMessage,
  ChatMessageSeparator,
  ChatThread,
  NonceProvider,
} from "@softistx/material/embed";
import { type RefObject, useEffect, useRef } from "react";
import { ACCEPTED_TYPES } from "../../files/model/rules";
import type { RequestDetail } from "../api";
import type { RequestsMessages } from "../model/messages";
import { pageNonce } from "../model/nonce";

export interface Composer {
  value: string;
  onValueChange: (value: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onSend: (body: string, attached: File[]) => void;
  sending: boolean;
}

/**
 * Opens the transcript on its latest message, and keeps it there while the content settles
 * (the team's markdown arrives in a lazy chunk and grows the bubbles) until the reader scrolls.
 */
function useOpenAtLatest(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const host = ref.current;
    // `role="log"` is the content; its parent, material's scroll-area viewport, is what scrolls.
    const log = host?.querySelector<HTMLElement>('[role="log"]');
    const viewport =
      host?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ??
      log;
    if (!host || !log || !viewport) return;
    let following = true;
    const toEnd = () => {
      if (following) viewport.scrollTop = viewport.scrollHeight;
    };
    const stop = () => {
      following = false;
    };
    toEnd();
    viewport.addEventListener("wheel", stop, { passive: true });
    viewport.addEventListener("touchstart", stop, { passive: true });
    viewport.addEventListener("keydown", stop);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(toEnd);
    observer?.observe(log);
    for (const child of log.children) observer?.observe(child);
    const timer = setTimeout(stop, 4000);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      viewport.removeEventListener("wheel", stop);
      viewport.removeEventListener("touchstart", stop);
      viewport.removeEventListener("keydown", stop);
    };
  }, [ref]);
}

/** The request's own description followed by its replies, with the composer when replies are open. */
export function ThreadChat({
  text,
  detail,
  composer,
  formatDate,
  formatTime,
}: {
  text: RequestsMessages;
  detail: RequestDetail;
  composer: Composer;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
}) {
  const t = text.thread;
  const host = useRef<HTMLDivElement>(null);
  useOpenAtLatest(host);
  const items = [
    {
      id: "original",
      from: "reporter" as const,
      body: detail.description,
      at: detail.createdAt,
      files: detail.files,
    },
    ...detail.thread,
  ];
  return (
    <NonceProvider nonce={pageNonce()}>
      <div ref={host} className="contents">
        <ChatThread
          surface="card"
          className={
            detail.canReply
              ? "h-[min(460px,58dvh)] max-sm:h-[42dvh]"
              : "h-auto max-h-[min(460px,58dvh)] max-sm:max-h-[42dvh]"
          }
          messageListProps={{ itemCount: items.length + 1 }}
          // The disabled Send arrow is faint: Temporary, until material#5602 (ChatComposer contrast).
          composerProps={
            detail.canReply
              ? {
                  value: composer.value,
                  onValueChange: composer.onValueChange,
                  attachments: composer.files,
                  onAttachmentsChange: composer.onFilesChange,
                  onSend: composer.onSend,
                  isLoading: composer.sending,
                  placeholder: t.placeholder,
                  sendLabel: t.send,
                  attachmentLabel: t.attach,
                  accept: ACCEPTED_TYPES.join(","),
                  maxFiles: 3,
                  maxLength: 4000,
                }
              : undefined
          }
          footer={
            detail.canReply ? undefined : (
              <p className="m-0 px-4 py-3 text-muted-foreground text-sm">
                {t.readOnly}
              </p>
            )
          }
        >
          <ChatMessageSeparator label={formatDate(detail.createdAt)} />
          {/* The team's replies are markdown (a lazy chunk, plain text until it arrives); what the
            reporter typed stays plain text, never markdown and never auto-linked. */}
          {items.map((message) => (
            <ChatMessage
              key={message.id}
              variant={message.from === "reporter" ? "user" : "assistant"}
              author={message.from === "reporter" ? t.you : t.team}
              avatarFallback={t.team.charAt(0)}
              timestamp={formatTime(message.at)}
              text={message.from === "reporter" ? message.body : undefined}
              // Copy's hover toolbar floats over the bubble's corner and hides its words on a
              // phone; the words stay selectable. Temporary, until material#5601 (ChatMessage copy toolbar placement).
              copyable={false}
              footer={
                message.files.length ? (
                  <ul
                    aria-label={t.attachments}
                    className="m-0 flex list-none flex-wrap gap-1.5 p-0"
                  >
                    {message.files.map((file) => (
                      <li key={file.id}>
                        <Badge variant="soft">{file.name}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
            >
              {message.from === "reporter" ? undefined : (
                <ChatMarkdown
                  content={message.body}
                  math={false}
                  mermaid={false}
                  flow={false}
                />
              )}
            </ChatMessage>
          ))}
        </ChatThread>
      </div>
    </NonceProvider>
  );
}
