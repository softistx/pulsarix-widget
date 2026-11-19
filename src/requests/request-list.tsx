import { Badge, ListRow } from "@softistx/material/embed";
import type { Locale } from "../config";
import type { Messages } from "../messages";
import type { PublicState, RequestSummary } from "./api";
import { REQUESTS_MESSAGES } from "./messages";

const STATE_TONE = {
  received: "neutral",
  inProgress: "info",
  resolved: "success",
  declined: "warning",
} as const satisfies Record<PublicState, string>;

export interface RequestListProps {
  messages: Messages;
  locale: Locale;
  label: string;
  nodes: RequestSummary[];
  onOpen: (request: RequestSummary) => void;
}

/**
 * The reporter's requests, one row each. Each row is a container: from `@md` the status badge
 * sits at the row's end; below it the badge moves under the title (with the meta line) and both
 * lines wrap, so a narrow phone never cuts the title or the meta to an ellipsis.
 */
export function RequestList({
  messages,
  locale,
  label,
  nodes,
  onOpen,
}: RequestListProps) {
  const text = REQUESTS_MESSAGES[locale];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const stateBadge = (state: PublicState) => (
    <Badge variant="soft" tone={STATE_TONE[state]}>
      {text.states[state]}
    </Badge>
  );
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-2 p-0"
    >
      {nodes.map((request) => (
        <li
          key={request.id}
          // A container, so the badge moves by the list's width, not the window's.
          className="@container min-w-0 rounded-lg bg-card"
        >
          <button
            type="button"
            aria-label={text.open(request.title)}
            onClick={() => onOpen(request)}
            className="block w-full cursor-pointer rounded-lg text-left"
          >
            <ListRow
              unread={request.unread > 0}
              title={
                <span className="block whitespace-normal break-words @md:truncate @md:whitespace-nowrap">
                  {request.title}
                </span>
              }
              meta={
                <span className="block whitespace-normal @md:truncate @md:whitespace-nowrap">
                  <span className="mb-1 block @md:hidden">
                    {stateBadge(request.publicState)}
                  </span>
                  {[
                    date.format(new Date(request.createdAt)),
                    request.type
                      ? messages.choices.type[
                          request.type as keyof typeof messages.choices.type
                        ]
                      : null,
                    request.impact
                      ? messages.choices.impact[
                          request.impact as keyof typeof messages.choices.impact
                        ]
                      : null,
                    request.unread > 0 ? text.newReplies(request.unread) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              }
              badge={
                <span className="hidden @md:inline-flex">
                  {stateBadge(request.publicState)}
                </span>
              }
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
