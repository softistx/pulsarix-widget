import {
  Badge,
  ChatMarkdown,
  ChatMessage,
  ChatMessageSeparator,
  ChatThread,
  NonceProvider,
} from "@softistx/material/embed";
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
      <ChatThread
        surface="card"
        className="h-[min(460px,54dvh)]"
        messageListProps={{ itemCount: items.length + 1 }}
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
            : { disabled: true, disabledReason: t.readOnly }
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
              <ChatMarkdown content={message.body} />
            )}
          </ChatMessage>
        ))}
      </ChatThread>
    </NonceProvider>
  );
}
